const fs = require('fs');

const files = fs.readdirSync('supabase/migrations').filter(f => f.endsWith('.sql')).map(f => 'supabase/migrations/' + f);
const tables = ['payout_ledger', 'payout_batches', 'payout_disputes', 'provider_bank_details', 'operator_bank_details', 'documents', 'reviews', 'notifications', 'system_audit_log'];
const policies = {};

files.forEach(file => {
    const content = fs.readFileSync(file, 'utf-8');
    const stmts = content.split(';');
    stmts.forEach(stmt => {
        if (stmt.toUpperCase().includes('CREATE POLICY')) {
            tables.forEach(table => {
                const normalizedStmt = stmt.replace(/\s+/g, ' ');
                const match1 = new RegExp('ON public\\.' + table + '\\b', 'i');
                const match2 = new RegExp('ON ' + table + '\\b', 'i');
                if (match1.test(normalizedStmt) || match2.test(normalizedStmt)) {
                    if (!policies[table]) policies[table] = [];
                    policies[table].push(stmt.trim());
                }
            });
        }
    });
});

fs.writeFileSync('policies_output.txt', Object.keys(policies).map(t => `\n--- ${t} ---\n` + policies[t].join(';\n\n')).join('\n'));
