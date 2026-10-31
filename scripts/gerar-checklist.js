// Lê resultado.json (gerado pelo Playwright) e monta comentario.md com o checklist.
const fs = require('fs');

const sha = (process.env.HEAD_SHA || '').slice(0, 7);
const run = process.env.RUN_URL || '';
const MARCA = '<!-- autoavaliacao -->';

const escapar = (s = '') =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\|/g, '\\|');
const limpar = (s = '') => s.replace(/\x1b\[[0-9;]*m/g, '');
const primeiraLinha = (s = '') =>
  limpar(s).split('\n').map((l) => l.trim()).find(Boolean)?.replace(/^Error:\s*/, '') || '';

function coletar(suite, saida) {
  for (const spec of suite.specs || []) {
    const t = spec.tests?.[0];
    const r = t?.results?.[0];
    saida.push({
      titulo: spec.title,
      ok: spec.ok === true,
      pulado: t?.status === 'skipped',
      erro: primeiraLinha(r?.error?.message || r?.errors?.[0]?.message || ''),
    });
  }
  for (const s of suite.suites || []) coletar(s, saida);
}

let corpo;
try {
  const dados = JSON.parse(fs.readFileSync('resultado.json', 'utf8'));
  const itens = [];
  for (const s of dados.suites || []) coletar(s, itens);
  if (!itens.length) throw new Error('sem testes no resultado');

  const feitos = itens.filter((i) => i.ok).length;
  const linhas = itens.map((i) => {
    const icone = i.ok ? '✅' : i.pulado ? '⏭️' : '❌';
    const falta = i.ok ? '—' : escapar(i.erro) || 'Veja o log da execução';
    return `| ${icone} | ${escapar(i.titulo)} | ${falta} |`;
  });

  corpo = `### ${feitos}/${itens.length} requisitos concluídos\n\n`;
  corpo += '| Resultado | Requisito | O que falta |\n|:-:|---|---|\n' + linhas.join('\n') + '\n\n';
  corpo += feitos === itens.length
    ? '🎉 **Todos os requisitos foram concluídos!** O merge está liberado.'
    : 'Corrija o que está com ❌ e envie um novo commit. Este checklist é atualizado automaticamente.';
} catch (e) {
  corpo = '⚠️ Os testes não puderam ser executados neste commit. ' +
    (run ? `Veja o [log da execução](${run}) para entender o motivo.` : 'Veja o log da execução.');
}

const rodape = `\n\n<sub>Último commit avaliado: \`${sha || 'desconhecido'}\`${run ? ` · [ver log completo](${run})` : ''}</sub>`;
const md = `${MARCA}\n## 🧪 Autoavaliação\n\n${corpo}${rodape}\n`;

fs.writeFileSync('comentario.md', md);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
console.log(md);
