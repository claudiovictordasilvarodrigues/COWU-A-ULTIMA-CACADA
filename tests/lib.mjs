// Mini-framework de testes sem dependências (roda no Node e no navegador)
export const suites = [];
export function suite(name, tests) { suites.push({ name, tests }); }
export function assert(cond, msg = 'falhou') { if (!cond) throw new Error(msg); }
export function eq(a, b, msg = '') { if (a !== b) throw new Error(`${msg} esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`); }
export async function runAll(log = console.log) {
  let pass = 0, fail = 0;
  for (const s of suites) {
    log(`\n${s.name}`);
    for (const [name, fn] of s.tests) {
      const t0 = Date.now();
      try { await fn(); pass++; log(`  ✓ ${name} (${Date.now() - t0} ms)`); }
      catch (e) { fail++; log(`  ✗ ${name}\n      ${e && e.message}`); }
    }
  }
  log(`\n${pass} passaram, ${fail} falharam.`);
  return { pass, fail };
}
