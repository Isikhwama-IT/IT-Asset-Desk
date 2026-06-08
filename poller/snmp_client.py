from __future__ import annotations

import asyncio
from typing import Any, List, Optional, Tuple

from config import SNMP_PORT, SNMP_VERSION


TIMEOUT_SECONDS = 3
RETRIES = 2

try:
    from pysnmp.hlapi import (
        CommunityData,
        ContextData,
        ObjectIdentity,
        ObjectType,
        SnmpEngine,
        UdpTransportTarget,
        getCmd,
        nextCmd,
    )
except Exception:
    CommunityData = None
    ContextData = None
    ObjectIdentity = None
    ObjectType = None
    SnmpEngine = None
    UdpTransportTarget = None
    getCmd = None
    nextCmd = None

try:
    from pysnmp.hlapi.v3arch.asyncio import (
        CommunityData as AsyncCommunityData,
        ContextData as AsyncContextData,
        ObjectIdentity as AsyncObjectIdentity,
        ObjectType as AsyncObjectType,
        SnmpEngine as AsyncSnmpEngine,
        UdpTransportTarget as AsyncUdpTransportTarget,
        get_cmd as async_get_cmd,
        walk_cmd as async_walk_cmd,
    )
except Exception:
    AsyncCommunityData = None
    AsyncContextData = None
    AsyncObjectIdentity = None
    AsyncObjectType = None
    AsyncSnmpEngine = None
    AsyncUdpTransportTarget = None
    async_get_cmd = None
    async_walk_cmd = None


def _stringify(value: Any) -> str:
    if hasattr(value, "prettyPrint"):
        return str(value.prettyPrint())
    return str(value)


def _legacy_ready() -> bool:
    return all([CommunityData, ContextData, ObjectIdentity, ObjectType, SnmpEngine, UdpTransportTarget, getCmd, nextCmd])


def _async_ready() -> bool:
    return all(
        [
            AsyncCommunityData,
            AsyncContextData,
            AsyncObjectIdentity,
            AsyncObjectType,
            AsyncSnmpEngine,
            AsyncUdpTransportTarget,
            async_get_cmd,
            async_walk_cmd,
        ]
    )


def _mp_models() -> List[int]:
    if SNMP_VERSION in ("1", "v1"):
        return [0]
    if SNMP_VERSION in ("auto", "any"):
        return [1, 0]
    return [1]


def _legacy_transport(ip: str):
    return UdpTransportTarget((ip, SNMP_PORT), timeout=TIMEOUT_SECONDS, retries=RETRIES)


def _legacy_get(ip: str, community: str, oid: str, mp_model: int) -> Optional[str]:
    try:
        iterator = getCmd(
            SnmpEngine(),
            CommunityData(community, mpModel=mp_model),
            _legacy_transport(ip),
            ContextData(),
            ObjectType(ObjectIdentity(oid)),
            lookupMib=False,
        )
        error_indication, error_status, error_index, var_binds = next(iterator)

        if error_indication or error_status:
            return None

        for _, value in var_binds:
            return _stringify(value)
    except Exception:
        return None

    return None


def _legacy_walk(ip: str, community: str, oid_prefix: str, mp_model: int) -> List[Tuple[str, str]]:
    rows: List[Tuple[str, str]] = []

    try:
        iterator = nextCmd(
            SnmpEngine(),
            CommunityData(community, mpModel=mp_model),
            _legacy_transport(ip),
            ContextData(),
            ObjectType(ObjectIdentity(oid_prefix)),
            lexicographicMode=False,
            lookupMib=False,
        )

        for error_indication, error_status, error_index, var_binds in iterator:
            if error_indication or error_status:
                break
            for oid, value in var_binds:
                rows.append((_stringify(oid), _stringify(value)))
    except Exception:
        return []

    return rows


async def _async_get(ip: str, community: str, oid: str, mp_model: int) -> Optional[str]:
    engine = AsyncSnmpEngine()

    try:
        error_indication, error_status, error_index, var_binds = await async_get_cmd(
            engine,
            AsyncCommunityData(community, mpModel=mp_model),
            await AsyncUdpTransportTarget.create((ip, SNMP_PORT), timeout=TIMEOUT_SECONDS, retries=RETRIES),
            AsyncContextData(),
            AsyncObjectType(AsyncObjectIdentity(oid)),
            lookupMib=False,
        )

        if error_indication or error_status:
            return None

        for _, value in var_binds:
            return _stringify(value)
    except Exception:
        return None
    finally:
        try:
            engine.close_dispatcher()
        except Exception:
            pass

    return None


async def _async_walk(ip: str, community: str, oid_prefix: str, mp_model: int) -> List[Tuple[str, str]]:
    rows: List[Tuple[str, str]] = []
    engine = AsyncSnmpEngine()

    try:
        transport = await AsyncUdpTransportTarget.create((ip, SNMP_PORT), timeout=TIMEOUT_SECONDS, retries=RETRIES)
        iterator = async_walk_cmd(
            engine,
            AsyncCommunityData(community, mpModel=mp_model),
            transport,
            AsyncContextData(),
            AsyncObjectType(AsyncObjectIdentity(oid_prefix)),
            lexicographicMode=False,
            lookupMib=False,
        )

        async for error_indication, error_status, error_index, var_binds in iterator:
            if error_indication or error_status:
                break
            for oid, value in var_binds:
                rows.append((_stringify(oid), _stringify(value)))
    except Exception:
        return []
    finally:
        try:
            engine.close_dispatcher()
        except Exception:
            pass

    return rows


def get(ip: str, community: str, oid: str) -> Optional[str]:
    if _legacy_ready():
        for mp_model in _mp_models():
            value = _legacy_get(ip, community, oid, mp_model)
            if value is not None:
                return value
        return None

    if _async_ready():
        for mp_model in _mp_models():
            try:
                value = asyncio.run(_async_get(ip, community, oid, mp_model))
            except Exception:
                value = None
            if value is not None:
                return value
        return None

    return None


def walk(ip: str, community: str, oid_prefix: str) -> List[Tuple[str, str]]:
    if _legacy_ready():
        for mp_model in _mp_models():
            rows = _legacy_walk(ip, community, oid_prefix, mp_model)
            if rows:
                return rows
        return []

    if _async_ready():
        for mp_model in _mp_models():
            try:
                rows = asyncio.run(_async_walk(ip, community, oid_prefix, mp_model))
            except Exception:
                rows = []
            if rows:
                return rows
        return []

    return []
