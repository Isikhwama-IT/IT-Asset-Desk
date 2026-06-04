const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

function parseEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return {};
  const text = fs.readFileSync(envPath, 'utf8');
  const lines = text.split(/\r?\n/);
  const out = {};
  for (const line of lines) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let [, key, val] = m;
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    out[key] = val;
  }
  return out;
}

function parseCSV(text) {
  const rows = [];
  let cur = '';
  let inQuotes = false;
  let field = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      field.push(cur);
      cur = '';
    } else if ((c === '\n' || c === '\r') && !inQuotes) {
      // handle CRLF
      if (c === '\r' && text[i + 1] === '\n') i++;
      field.push(cur);
      rows.push(field);
      field = [];
      cur = '';
    } else {
      cur += c;
    }
  }
  if (cur !== '' || field.length) {
    field.push(cur);
    rows.push(field);
  }
  return rows;
}

(async function main(){
  try {
    const repoRoot = path.resolve(__dirname, '..');
    const env = parseEnvFile(path.join(repoRoot, '.env.local'));
    const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local or environment.');
      process.exit(1);
    }

    const csvPath = path.join(process.env.USERPROFILE || process.env.HOME || '', 'Downloads', 'Objectives b81742e2967b4900934b34f7939dcc57_all.csv');
    if (!fs.existsSync(csvPath)) {
      // fallback to repo path if present
      const alt = path.join(repoRoot, 'Objectives.csv');
      if (fs.existsSync(alt)) {
        console.log('Using', alt);
      } else {
        console.error('CSV file not found at', csvPath);
        process.exit(1);
      }
    }
    const actualCsvPath = fs.existsSync(csvPath) ? csvPath : path.join(repoRoot, 'Objectives.csv');
    const csv = fs.readFileSync(actualCsvPath, 'utf8');
    const rows = parseCSV(csv);
    if (rows.length < 2) {
      console.error('No data in CSV');
      process.exit(1);
    }
    const headers = rows[0].map(h => h.trim());
    const data = rows.slice(1).map(r => {
      const obj = {};
      for (let i = 0; i < headers.length; i++) {
        obj[headers[i]] = (r[i] || '').trim();
      }
      return obj;
    });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false }
    });

    let created = 0;
    for (const row of data) {
      const title = row['Objective'] || row['Objective'] === '' ? row['Objective'] : null;
      if (!title) continue;
      // check existing
      const { data: existing, error: selErr } = await supabase.from('tasks').select('id').eq('title', title).limit(1);
      if (selErr) {
        console.error('Select error', selErr.message);
        process.exit(1);
      }
      if ((existing || []).length > 0) continue;

      const priority = row['Priority'] || 'Standard';
      const status = row['Status'] || 'Intel';
      const category = row['Category'] || null;
      const source = row['Source'] || null;

      // sanitize due date: handle ranges like "June 1, 2026 → June 1, 2026"
      let rawDue = (row['Due Date'] || '').trim();
      let due_date = null;
      if (rawDue) {
        if (rawDue.includes('→')) rawDue = rawDue.split('→')[0].trim();
        const parsed = Date.parse(rawDue);
        if (!isNaN(parsed)) due_date = new Date(parsed).toISOString();
        else due_date = null;
      }

      const insertObj = {
        title: title.trim(),
        priority: priority || 'Standard',
        status: status || 'Intel',
        category: category || null,
        source: source || null,
        due_date: due_date,
      };

      const { error: insErr } = await supabase.from('tasks').insert(insertObj);
      if (insErr) {
        console.error('Insert error for', title, insErr.message);
        // continue with next row instead of exiting
        continue;
      }
      created++;
      console.log('Created task:', insertObj.title);
    }

    console.log('Import completed. Created:', created);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
