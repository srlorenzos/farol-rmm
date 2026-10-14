import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { parseScript, parseYamlSimples, separarCabecalho } from '../src/modulos/biblioteca/parser.js';
import { carregarBiblioteca } from '../src/modulos/biblioteca/index.js';
import { RAIZ_SERVIDOR } from '../src/config.js';
import { novoApp, adminElevado, PASTA_FIXTURES } from './ajuda.js';

const PASTA = join(PASTA_FIXTURES, 'biblioteca');

test('YAML simples: escalares, listas inline, listas de mapas e comentários', () => {
  const y = parseYamlSimples([
    'id: x', 'tempo_limite: 300   # segundos', 'requer_admin: true', 'so: [windows, "linux"]', 'nada:', 'descricao: "C# e # dentro"',
    'variaveis:', '  - nome: A', '    tipo: numero', '    padrao: 7', '  - nome: B', '    opcoes: []', 'tags:', '  - um', '  - dois',
  ]);
  assert.equal(y.tempo_limite, 300);
  assert.equal(y.requer_admin, true);
  assert.deepEqual(y.so, ['windows', 'linux']);
  assert.equal(y.nada, null);
  assert.equal(y.descricao, 'C# e # dentro');
  assert.deepEqual(y.variaveis, [{ nome: 'A', tipo: 'numero', padrao: 7 }, { nome: 'B', opcoes: [] }]);
  assert.deepEqual(y.tags, ['um', 'dois']);
  assert.throws(() => parseYamlSimples(['  solto: 1']), /indentação/);
});

test('cabeçalho: shebang e @echo off ficam no corpo; sem cabeçalho é erro', () => {
  const { cabecalho, corpo } = separarCabecalho('#!/bin/bash\n# ---\n# id: a\n# ---\necho oi\n', 'sh');
  assert.deepEqual(cabecalho, ['id: a']);
  assert.equal(corpo, '#!/bin/bash\necho oi\n');
  assert.throws(() => separarCabecalho('echo oi', 'sh'), /não encontrado/);
  assert.throws(() => separarCabecalho('# ---\n# id: a\necho\n', 'sh'), /terminou/);
});

test('carregar fixtures: indexa válidos e lista erros sem derrubar', () => {
  const { itens, erros } = carregarBiblioteca(PASTA);
  assert.deepEqual([...itens.keys()].sort(), ['espaco-disco', 'limpar-temp', 'testar-porta']);
  const lt = itens.get('limpar-temp');
  assert.equal(lt.categoria, 'Manutenção');
  assert.equal(lt.categoria_slug, 'manutencao');
  assert.deepEqual(lt.so, ['windows']);
  assert.equal(lt.shell, 'powershell');
  assert.equal(lt.tempo_limite, 300);
  assert.equal(lt.requer_admin, true);
  assert.deepEqual(lt.tags, ['limpeza', 'disco']);
  assert.deepEqual(lt.variaveis, [{ nome: 'DIAS', tipo: 'numero', rotulo: 'Apagar arquivos mais antigos que (dias)', padrao: 7, obrigatorio: false, opcoes: [] }]);
  assert.ok(lt.conteudo.startsWith('$dias'), 'cabeçalho removido do corpo');
  const tp = itens.get('testar-porta');
  assert.equal(tp.shell, 'cmd');
  assert.ok(tp.conteudo.startsWith('@echo off'));
  assert.equal(tp.variaveis[0].obrigatorio, true);
  assert.equal(itens.get('espaco-disco').tipo, 'monitor');
  assert.equal(erros.length, 2);
  assert.ok(erros.some((e) => /id-errado/.test(e.arquivo) && /nome do arquivo/.test(e.erro)));
});

test('parser recusa shell incompatível com a extensão e SO inválido', () => {
  const base = { extensao: 'sh', idArquivo: 'x', categoriaSlug: 'c', arquivo: 'c/x.sh' };
  assert.throws(() => parseScript('# ---\n# id: x\n# nome: X\n# so: [linux]\n# shell: powershell\n# ---\nls', base), /extensão/);
  assert.throws(() => parseScript('# ---\n# id: x\n# nome: X\n# so: [solaris]\n# ---\nls', base), /so inválido/);
  assert.throws(() => parseScript('# ---\n# id: x\n# nome: X\n# so: linux\n# tempo_limite: 1\n# ---\nls', base), /tempo_limite/);
});

test('API: busca, filtros, detalhe, importação e erros', async () => {
  const { app, db } = await novoApp();
  const { c } = await adminElevado(app, db, { elevar: false });
  const tudo = (await c.get('/api/biblioteca')).json;
  assert.equal(tudo.total, 3);
  assert.deepEqual(tudo.categorias.map((x) => x.nome), ['Manutenção', 'Monitoramento', 'Rede']);
  assert.equal(tudo.itens[0].conteudo, undefined, 'lista não traz o conteúdo');
  assert.deepEqual((await c.get('/api/biblioteca?q=temporarios')).json.itens.map((i) => i.id), ['limpar-temp'], 'busca ignora acentos');
  assert.deepEqual((await c.get('/api/biblioteca?so=linux')).json.itens.map((i) => i.id), ['espaco-disco']);
  assert.equal((await c.get('/api/biblioteca?tipo=monitor')).json.itens.length, 1);
  assert.equal((await c.get('/api/biblioteca?tag=limpeza')).json.itens.length, 1);
  const det = (await c.get('/api/biblioteca/limpar-temp')).json;
  assert.ok(det.conteudo.includes('FAROL_DIAS'));
  assert.equal(det.importado_id, null);
  const imp = await c.post('/api/biblioteca/limpar-temp/importar');
  assert.equal(imp.status, 200);
  assert.equal(imp.json.origem, 'biblioteca:limpar-temp');
  assert.equal(imp.json.variaveis[0].nome, 'DIAS');
  assert.deepEqual(imp.json.so, ['windows']);
  assert.equal((await c.get('/api/biblioteca/limpar-temp')).json.importado_id, imp.json.id);
  assert.equal((await c.get('/api/biblioteca/erros')).json.erros.length, 2);
  assert.equal((await c.get('/api/biblioteca/nao-existe')).status, 404);
  await app.close();
});

test('biblioteca real (servidor/biblioteca), se existir, carrega', { skip: !existsSync(join(RAIZ_SERVIDOR, 'biblioteca')) }, () => {
  const { itens, erros } = carregarBiblioteca(join(RAIZ_SERVIDOR, 'biblioteca'));
  assert.ok(itens.size > 0);
  // Erros aqui são do conteúdo da biblioteca (outro fluxo de trabalho); só registra.
  if (erros.length) console.log(`biblioteca real: ${itens.size} ok, ${erros.length} com erro (ex.: ${erros[0].arquivo}: ${erros[0].erro})`);
});
