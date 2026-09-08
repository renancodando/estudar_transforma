import {
  buscarGoogle,
  buscarOpenLibrary,
  buscarGutendex,
  buscarRapido,
  buscarProfundo,
  enriquecerLivro,
  mesclarLivros,
  resolverLivroDoUsuario
} from './apis.js';

const app = document.querySelector('#app');
const modal = document.querySelector('#modal');
const toast = document.querySelector('#toast');
const estado = {
  livros: new Map(),
  ultimoTermo: '',
  ultimaBuscaProfunda: false,
  movimento: true
};

const frasesCriticas = [
  'O acesso ao conhecimento não pode depender do dinheiro. Saber é um direito, não um privilégio.',
  'Educar não é formar pessoas obedientes, mas capazes de questionar.',
  'A educação no Brasil ainda forma para obedecer, não para questionar.',
  'Conhecimento não é mercadoria. É um bem comum, essencial para uma sociedade mais justa.'
];

function escapar(valor = '') {
  return String(valor).replace(/[&<>'"]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[ch]));
}

function textoLimpo(html = '') {
  const caixa = document.createElement('div');
  caixa.innerHTML = html;
  return caixa.textContent || '';
}

function notificar(mensagem) {
  toast.textContent = mensagem;
  toast.classList.add('visivel');
  clearTimeout(notificar.timer);
  notificar.timer = setTimeout(() => toast.classList.remove('visivel'), 2800);
}

function registrar(livro) {
  estado.livros.set(livro.id, livro);
  return livro;
}

function obterLivro(id) {
  return estado.livros.get(id) || (() => {
    try { return JSON.parse(sessionStorage.getItem(`livro:${id}`) || 'null'); } catch { return null; }
  })();
}

function persistir(livro) {
  registrar(livro);
  try { sessionStorage.setItem(`livro:${livro.id}`, JSON.stringify(livro)); } catch {}
}

function capaHtml(livro, classe = 'capa-mini') {
  if (!livro.capa) return `<div class="${classe} sem-capa">${escapar(livro.titulo)}</div>`;
  return `<div class="${classe}" style="background-image:url('${escapar(livro.capa)}')" role="img" aria-label="Capa de ${escapar(livro.titulo)}"></div>`;
}

function fontesTags(livro) {
  return (livro.fontes || []).slice(0, 3).map(f => `<span>${escapar(f)}</span>`).join('');
}

function botaoDisponivel(livro) {
  if (livro.leituraOnline || livro.links?.google || livro.links?.openlibrary || livro.links?.gutenberg) {
    return `<button class="primario" data-detalhe="${escapar(livro.id)}">Ver detalhes</button>`;
  }
  return `<button data-detalhe="${escapar(livro.id)}">Ver edição</button>`;
}

function atualizarNav(nome) {
  document.querySelectorAll('[data-nav]').forEach(el => el.classList.toggle('ativo', el.dataset.nav === nome));
}

async function renderHome() {
  atualizarNav('inicio');
  app.innerHTML = `
    <section class="hero">
      <div class="hero-inner">
        <div>
          <h1>Leia antes que decidam por você.</h1>
          <p class="hero-sub">Uma biblioteca digital para mentes livres. Pesquise em múltiplas fontes, redescubra ideias, questione o que te ensinaram e construa seu próprio pensamento.</p>
          <form class="busca-grande" data-form-busca>
            <input name="q" autocomplete="off" placeholder="Pesquise um livro, autor, assunto ou ISBN..." aria-label="Pesquisar livros">
            <button>Pesquisar</button>
          </form>
          <div class="fontes-inline">
            <span>Busca híbrida:</span><span class="fonte-pill">◉ Google Books</span><span class="fonte-pill">▤ Open Library</span><span class="fonte-pill">G Project Gutenberg</span>
          </div>
          <p class="microfrase">LER É RESISTIR.</p>
        </div>
        <aside class="hero-direita">
          <div class="manifesto-flutuante">
            <blockquote>“Quando tudo precisa gerar lucro, até aprender corre o risco de virar produto.”</blockquote>
            <p>Mais livros.<br>Mais perguntas.<br>Mais pensamento.<br>Mais liberdade.</p>
            <div class="palavras-verticais">livros · ideias · pessoas · mundos · liberdade</div>
          </div>
        </aside>
      </div>
    </section>
    <section class="faixa-valores">
      ${frasesCriticas.map(f => `<article>“${f}”</article>`).join('')}
    </section>
    <section class="home-conteudo">
      <div class="bloco-home">
        <div class="titulo-secao"><div><h2>Explorar</h2><small>IDEIAS PARA NOVOS HORIZONTES</small></div></div>
        <div class="grade-temas">
          ${['Filosofia','Literatura','Ciências Sociais','História','Ciência','Artes','Política','Educação'].map((t,i)=>`<button class="tema" style="--x:${20+i*8}%;--y:${15+(i%3)*25}%" data-tema="${t}"><span>${t}</span></button>`).join('')}
        </div>
      </div>
      <div class="bloco-home">
        <div class="titulo-secao"><div><h2>Livros que incomodaram</h2><small>OBRAS QUE DESAFIARAM O SEU TEMPO</small></div><button class="link-sutil" data-acao="explorar-criticos">Ver todos →</button></div>
        <div id="destaques" class="carrossel-livros"><div class="loading">Carregando capas reais pelas APIs…</div></div>
      </div>
      <div class="bloco-home bloco-manifesto">
        <h2>Mais que livros,<br>uma sociedade mais crítica.</h2>
        <p class="destaque">“Uma sociedade mais justa começa com pessoas mais informadas.”</p>
        <p>Conhecimento precisa circular livremente, sem barreiras econômicas, sem elitismo e sem censura. O site também pergunta quem lucra quando aprender vira produto.</p>
        <button class="botao-verde" data-acao="manifesto">Conheça nosso manifesto →</button>
      </div>
    </section>`;
  ligarEventosDaPagina();
  carregarDestaques();
}

async function carregarDestaques() {
  const alvo = document.querySelector('#destaques');
  if (!alvo) return;
  const pesquisas = [
    'Dom Casmurro Machado de Assis',
    'Memórias Póstumas de Brás Cubas Machado de Assis',
    '1984 George Orwell',
    'O Capital Karl Marx'
  ];
  const resolvidos = await Promise.all(pesquisas.map(async termo => {
    try {
      const r = await buscarGoogle(termo, 4);
      return r[0] || null;
    } catch { return null; }
  }));
  const meuLivro = await resolverLivroDoUsuario();
  const livros = [...resolvidos.filter(Boolean), meuLivro].map(registrar);
  alvo.innerHTML = livros.map(livro => `
    <article class="cartao-mini">
      ${capaHtml(livro)}
      <h3>${escapar(livro.titulo)}</h3>
      <p>${escapar(livro.autores?.[0] || 'Autor não informado')}</p>
      <button data-detalhe="${escapar(livro.id)}">Abrir →</button>
    </article>`).join('');
  alvo.querySelectorAll('[data-detalhe]').forEach(btn => btn.addEventListener('click', () => abrirDetalhe(btn.dataset.detalhe)));
}

function renderLoading(titulo = 'Consultando bibliotecas…') {
  app.innerHTML = `<section class="pagina"><div class="cabecalho-pagina"><h1>${escapar(titulo)}</h1><p>Google Books → Open Library → Project Gutenberg</p></div><div class="loading">Buscando edições, capas e disponibilidade real…</div></section>`;
}

async function executarBusca(termo, profunda = false) {
  termo = termo.trim();
  if (!termo) return;
  estado.ultimoTermo = termo;
  estado.ultimaBuscaProfunda = profunda;
  renderLoading(`Buscando “${termo}”`);
  let resposta;
  try {
    resposta = profunda ? await buscarProfundo(termo) : await buscarRapido(termo);
  } catch (erro) {
    resposta = { livros: [], erros: [erro.message], modo: 'erro' };
  }
  resposta.livros.forEach(registrar);
  renderResultados(termo, resposta.livros, resposta.erros || [], profunda, resposta.modo);
  if (!profunda && resposta.livros.length) enriquecerPrimeiros(resposta.livros.slice(0, 6));
}

async function enriquecerPrimeiros(livros) {
  const enriquecidos = await Promise.all(livros.map(l => enriquecerLivro(l).catch(() => l)));
  enriquecidos.forEach(l => { persistir(l); const original = livros.find(x => x.titulo === l.titulo); if (original) estado.livros.set(original.id, { ...l, id: original.id }); });
}

function renderResultados(termo, livros, erros, profunda, modo) {
  atualizarNav('explorar');
  const cards = livros.length ? livros.map(livro => {
    persistir(livro);
    const descricao = textoLimpo(livro.descricao || '').slice(0, 130);
    return `<article class="cartao-livro">
      ${capaHtml(livro, 'capa')}
      <h3>${escapar(livro.titulo)}</h3>
      <div class="autor">${escapar(livro.autores?.join(', ') || 'Autor não informado')}</div>
      <div class="meta">${escapar(livro.ano || 'ano n/d')} · ${livro.dominioPublico ? 'acesso público' : escapar(livro.idioma || 'idioma n/d')}</div>
      ${descricao ? `<p>${escapar(descricao)}${descricao.length >= 130 ? '…' : ''}</p>` : ''}
      <div class="fontes-tags">${fontesTags(livro)}</div>
      <div class="acoes-card">${botaoDisponivel(livro)}</div>
    </article>`;
  }).join('') : `<div class="estado-vazio"><h2>Nenhum livro encontrado.</h2><p>Tente autor, ISBN ou uma busca mais ampla.</p><button class="botao-verde" data-acao="busca-profunda-termo">Fazer busca profunda</button></div>`;

  app.innerHTML = `<section class="pagina">
    <div class="cabecalho-pagina">
      <h1>Resultados para “${escapar(termo)}”</h1>
      <p>${profunda ? 'As três fontes foram consultadas em paralelo.' : `Busca rápida concluída via ${escapar(modo)}.`}</p>
      <form class="busca-pagina" data-form-busca><input name="q" value="${escapar(termo)}"><button>Pesquisar</button></form>
    </div>
    <div class="barra-fontes">
      <button class="ativo">Todos</button><button>Google Books</button><button>Open Library</button><button>Project Gutenberg</button>
      <button data-acao="busca-profunda-termo">Busca profunda</button>
    </div>
    ${erros.length ? `<div class="erro-api">Algumas fontes não responderam: ${escapar(erros.join(' · '))}. Os resultados disponíveis continuam funcionando.</div>` : ''}
    <div class="resultados-layout">
      <aside class="filtros">
        <h3>Refinar resultados</h3>
        <div class="grupo-filtro"><strong>Formato</strong><label><input type="checkbox" data-filtro="ler"> Leitura online</label><label><input type="checkbox" data-filtro="pdf"> PDF</label><label><input type="checkbox" data-filtro="epub"> EPUB</label></div>
        <div class="grupo-filtro"><strong>Acesso</strong><label><input type="checkbox" data-filtro="publico"> Domínio/acesso público</label></div>
        <div class="grupo-filtro"><strong>Fontes</strong><label>Google Books</label><label>Open Library</label><label>Project Gutenberg</label></div>
      </aside>
      <section class="resultados">
        <div class="resultados-topo"><strong>${livros.length} resultado${livros.length === 1 ? '' : 's'}</strong><span>Capas vindas das próprias fontes</span></div>
        <div class="grade-resultados">${cards}</div>
      </section>
      <aside class="lateral-critica">
        <blockquote>“O acesso ao conhecimento não pode depender do dinheiro. Saber é um direito, não um privilégio.”</blockquote>
        <blockquote>“A educação no Brasil ainda forma para obedecer, não para questionar.”</blockquote>
        <blockquote>“Conhecimento não é mercadoria. É um bem comum.”</blockquote>
        <small>LIVROS CONSTROEM PESSOAS LIVRES.</small>
      </aside>
    </div>
  </section>`;
  ligarEventosDaPagina();
  document.querySelectorAll('[data-detalhe]').forEach(btn => btn.addEventListener('click', () => abrirDetalhe(btn.dataset.detalhe)));
}

async function abrirDetalhe(id) {
  let livro = obterLivro(id);
  if (!livro) return notificar('Não encontrei os dados desse livro.');
  renderLoading(livro.titulo);
  try { livro = await enriquecerLivro(livro); } catch {}
  livro.id = id;
  persistir(livro);
  renderDetalhe(livro);
}

function linkFonte(nome, url) {
  if (!url) return '';
  return `<a class="fonte-grande" href="${escapar(url)}" target="_blank" rel="noopener">${escapar(nome)} ↗</a>`;
}

function escolherLinkLeitura(livro) {
  return livro.formatos?.html || livro.links?.google || livro.links?.archive || livro.links?.openlibrary || livro.links?.gutenberg || '';
}

function renderDetalhe(livro) {
  atualizarNav('explorar');
  const descricao = textoLimpo(livro.descricao || '') || 'Esta fonte não forneceu uma sinopse. Use os links de origem para consultar a edição e os metadados completos.';
  const capa = livro.capa ? `<img src="${escapar(livro.capa)}" alt="Capa real de ${escapar(livro.titulo)}">` : `<div class="sem-capa">Capa não disponível nesta fonte</div>`;
  const leitura = escolherLinkLeitura(livro);
  app.innerHTML = `<section class="pagina">
    <div class="detalhe-layout">
      <aside class="detalhe-capa">${capa}</aside>
      <article class="detalhe-conteudo">
        <small>${livro.dominioPublico ? 'ACESSO PÚBLICO / DOMÍNIO PÚBLICO' : 'CATÁLOGO MULTIFONTE'}</small>
        <h1>${escapar(livro.titulo)}</h1>
        <h2>${escapar(livro.autores?.join(', ') || 'Autor não informado')}</h2>
        <div class="etiquetas"><span>${escapar(livro.ano || 'ano não informado')}</span>${(livro.assunto || []).slice(0,4).map(a=>`<span>${escapar(a)}</span>`).join('')}</div>
        <p class="sinopse">${escapar(descricao)}</p>
        <blockquote class="frase-editorial">“Ler não é receber uma resposta pronta. É adquirir vocabulário para formular perguntas melhores.”</blockquote>
      </article>
      <aside class="painel-disponibilidade">
        <h3>Disponibilidade real</h3>
        ${linkFonte('Google Books', livro.links?.google || livro.links?.detalheGoogle)}
        ${linkFonte('Open Library', livro.links?.openlibrary)}
        ${linkFonte('Project Gutenberg', livro.links?.gutenberg)}
        ${livro.links?.edicao ? linkFonte('Ver edição do autor', livro.links.edicao) : ''}
        <div class="acoes-detalhe">
          ${leitura ? `<button class="primario" data-ler="${escapar(livro.id)}">Ler / pré-visualizar</button>` : ''}
          ${livro.formatos?.pdf ? `<a href="${escapar(livro.formatos.pdf)}" target="_blank" rel="noopener">Baixar PDF</a>` : ''}
          ${livro.formatos?.epub ? `<a href="${escapar(livro.formatos.epub)}" target="_blank" rel="noopener">Baixar EPUB</a>` : ''}
        </div>
        <p class="nota-legal">Os botões de download só aparecem quando uma das fontes informa um arquivo disponível. O site não inventa PDFs nem contorna direitos autorais.</p>
      </aside>
      <section class="relacionados"><h2>Continue explorando</h2><div id="relacionados" class="relacionados-grade"><div class="loading">Buscando obras relacionadas…</div></div></section>
    </div>
  </section>`;
  const botaoLer = document.querySelector('[data-ler]');
  if (botaoLer) botaoLer.addEventListener('click', () => abrirLeitor(livro));
  carregarRelacionados(livro);
}

async function carregarRelacionados(livro) {
  const alvo = document.querySelector('#relacionados');
  if (!alvo) return;
  const autor = livro.autores?.[0];
  if (!autor) { alvo.innerHTML = ''; return; }
  try {
    const r = await buscarGoogle(`inauthor:"${autor}"`, 8);
    const lista = r.filter(x => x.titulo !== livro.titulo).slice(0,6).map(registrar);
    alvo.innerHTML = lista.map(l => `<article class="cartao-mini">${capaHtml(l)}<h3>${escapar(l.titulo)}</h3><p>${escapar(l.autores?.[0] || '')}</p><button data-detalhe="${escapar(l.id)}">Abrir →</button></article>`).join('') || '<p>Nenhuma obra relacionada encontrada.</p>';
    alvo.querySelectorAll('[data-detalhe]').forEach(btn => btn.addEventListener('click', () => abrirDetalhe(btn.dataset.detalhe)));
  } catch { alvo.innerHTML = '<p>Não foi possível carregar relacionados agora.</p>'; }
}

function abrirLeitor(livro) {
  const link = escolherLinkLeitura(livro);
  if (!link) return notificar('Essa edição não oferece leitura online.');
  renderLeitor(livro, link);
}

function renderLeitor(livro, link) {
  atualizarNav('explorar');
  const podeGoogle = Boolean(livro.idGoogle || livro.isbn);
  app.innerHTML = `<section class="leitor">
    <header class="leitor-topo"><div><small>${escapar(livro.autores?.join(', ') || '')}</small><h1>${escapar(livro.titulo)}</h1></div><button class="botao-verde" data-voltar-detalhe="${escapar(livro.id)}">Voltar ao livro</button></header>
    <div class="leitor-grid">
      <aside class="sumario"><h3>Leitura</h3><button class="ativo">Edição disponível</button><button>Metadados</button><button>Fontes</button><button>Direitos e acesso</button></aside>
      <article class="leitura">
        <div class="leitura-toolbar"><span>A− &nbsp; A &nbsp; A+</span><span>Leitor da fonte original</span></div>
        ${podeGoogle ? `<div class="reader-google"><div id="google-book-viewer" class="loading">Carregando visualizador do Google Books…</div></div>` : `<div class="folha"><h2>${escapar(livro.titulo)}</h2><p>Esta edição é oferecida pela fonte original. Para preservar direitos e integridade do texto, a Biblioteca Livre não copia conteúdo integral de obras protegidas.</p><p>Use o botão ao lado para abrir a leitura oficial.</p></div>`}
      </article>
      <aside class="painel-leitor"><h3>Obter esta obra</h3>
        ${livro.formatos?.pdf ? `<a class="primario" href="${escapar(livro.formatos.pdf)}" target="_blank" rel="noopener">Baixar PDF</a>` : ''}
        ${livro.formatos?.epub ? `<a href="${escapar(livro.formatos.epub)}" target="_blank" rel="noopener">Baixar EPUB</a>` : ''}
        <a href="${escapar(link)}" target="_blank" rel="noopener">Abrir leitura original ↗</a>
        <h3>Fontes</h3>${linkFonte('Google Books', livro.links?.google)}${linkFonte('Open Library', livro.links?.openlibrary)}${linkFonte('Project Gutenberg', livro.links?.gutenberg)}
        <p class="nota-legal">Acesso e download respeitam a disponibilidade informada pelas fontes.</p>
      </aside>
    </div>
  </section>`;
  document.querySelector('[data-voltar-detalhe]')?.addEventListener('click', () => renderDetalhe(livro));
  if (podeGoogle) carregarGoogleViewer(livro);
}

function carregarGoogleViewer(livro) {
  const alvo = document.querySelector('#google-book-viewer');
  if (!alvo) return;
  const identificador = livro.idGoogle ? livro.idGoogle : (livro.isbn ? `ISBN:${livro.isbn}` : '');
  if (!identificador) return;
  const iniciar = () => {
    try {
      window.google.books.load();
      window.google.books.setOnLoadCallback(() => {
        const viewer = new window.google.books.DefaultViewer('google-book-viewer');
        viewer.load(identificador, () => {
          alvo.innerHTML = `<div class="folha"><h2>Prévia indisponível</h2><p>Esta edição não pôde ser incorporada. Abra a fonte original no painel à direita.</p></div>`;
        });
      });
    } catch { alvo.innerHTML = `<div class="folha"><h2>Visualizador indisponível</h2><p>Abra a fonte original para continuar.</p></div>`; }
  };
  if (window.google?.books) return iniciar();
  const script = document.createElement('script');
  script.src = 'https://www.google.com/books/jsapi.js';
  script.onload = iniciar;
  script.onerror = () => alvo.innerHTML = `<div class="folha"><h2>Visualizador indisponível</h2><p>Abra a fonte original para continuar.</p></div>`;
  document.head.appendChild(script);
}

function renderManifesto() {
  atualizarNav('manifesto');
  app.innerHTML = `<section class="manifesto-page"><div class="manifesto-grid">
    <article>
      <h1>Manifesto</h1>
      <h2>Ler não deveria depender de sorte.</h2>
      <p>Quando o acesso ao conhecimento depende de renda, cidade, escola ou assinatura, estudar deixa de funcionar como direito universal e passa a reproduzir desigualdades que já existiam antes da primeira página.</p>
      <h2>Educação não é treinamento para obediência.</h2>
      <p>Um sistema educacional que ensina a decorar respostas, mas não a questionar estruturas, corre o risco de formar mão de obra antes de formar cidadãos. Ensinar para a prova é diferente de ensinar para compreender o mundo.</p>
      <h2>Conhecimento não é mercadoria.</h2>
      <p>Livros têm custo, autores precisam ser remunerados e editoras realizam trabalho real. Ainda assim, existe uma diferença entre remunerar criação e transformar toda possibilidade de aprender em catraca. Bibliotecas, domínio público, licenças abertas e acesso coletivo provam que outros modelos também existem.</p>
      <h2>O comum também constrói futuros.</h2>
      <p>A tradição do comum — presente em experiências comunitárias, cooperativistas, socialistas e comunistas — lembra que cultura e educação também podem ser organizadas para uso coletivo, e não apenas para rentabilidade. Nenhuma tradição histórica é isenta de contradições; a pergunta que mantemos aberta é mais simples: quem deve poder aprender?</p>
    </article>
    <aside class="manifesto-coluna">
      <blockquote>“Uma sociedade que mede oportunidades apenas pela capacidade de pagamento não mede mérito: mede vantagem.”</blockquote>
      <blockquote>“O estudante não deveria aprender apenas a responder perguntas. Deveria aprender quem escolheu as perguntas.”</blockquote>
      <blockquote>“Quando tudo precisa gerar lucro, até aprender corre o risco de virar produto.”</blockquote>
      <div class="nota">A Biblioteca Livre não declara que uma única teoria econômica ou política resolve todos os problemas. Ela assume uma posição editorial mais básica: conhecimento, leitura e educação precisam ser mais acessíveis, plurais e criticáveis.</div>
    </aside>
  </div></section>`;
}

function abrirModalFontes() {
  modal.className = 'modal aberto'; modal.setAttribute('aria-hidden','false');
  modal.innerHTML = `<div class="modal-caixa"><div class="modal-topo"><h2>Como a busca funciona</h2><button class="fechar" data-fechar>×</button></div>
    <p><strong>Busca rápida:</strong> Google Books primeiro. Se não houver resultado, Open Library e depois Gutendex.</p>
    <p><strong>Enriquecimento:</strong> quando o Google encontra um livro, o site consulta as outras fontes em segundo plano para procurar leitura e formatos adicionais.</p>
    <p><strong>Busca profunda:</strong> consulta as três APIs ao mesmo tempo e mescla resultados semelhantes.</p>
    <p><strong>Capas:</strong> vêm dos metadados das fontes. Quando nenhuma fonte fornece capa, mostramos “capa não disponível”; não inventamos uma capa.</p>
    <p><strong>Downloads:</strong> só aparecem quando a própria fonte informa um PDF/EPUB disponível.</p>
    <p>Fontes: Google Books API, Open Library Search API e Gutendex/Project Gutenberg.</p></div>`;
  modal.querySelector('[data-fechar]').addEventListener('click', fecharModal);
}

function fecharModal() { modal.className='modal'; modal.setAttribute('aria-hidden','true'); modal.innerHTML=''; }

function ligarEventosDaPagina() {
  document.querySelectorAll('[data-form-busca]').forEach(form => form.addEventListener('submit', e => {
    e.preventDefault(); const termo = new FormData(form).get('q')?.toString() || ''; executarBusca(termo, false);
  }));
  document.querySelectorAll('[data-tema]').forEach(btn => btn.addEventListener('click', () => executarBusca(btn.dataset.tema, true)));
  document.querySelectorAll('[data-acao="busca-profunda-termo"]').forEach(btn => btn.addEventListener('click', () => executarBusca(estado.ultimoTermo, true)));
  document.querySelectorAll('[data-acao="manifesto"]').forEach(btn => btn.addEventListener('click', renderManifesto));
  document.querySelectorAll('[data-acao="explorar-criticos"]').forEach(btn => btn.addEventListener('click', () => executarBusca('sociedade política filosofia crítica', true)));
}

function rota() {
  const hash = location.hash || '#/';
  if (hash.startsWith('#/manifesto')) return renderManifesto();
  if (hash.startsWith('#/explorar')) { executarBusca('literatura filosofia sociedade', true); return; }
  if (hash.startsWith('#/dominio-publico')) { executarBusca('classic literature', true); return; }
  renderHome();
}

document.addEventListener('click', e => {
  const acao = e.target.closest('[data-acao]')?.dataset.acao;
  if (!acao) return;
  if (acao === 'sobre-fontes') abrirModalFontes();
  if (acao === 'busca-profunda') {
    if (estado.ultimoTermo) executarBusca(estado.ultimoTermo, true);
    else { renderHome(); setTimeout(() => document.querySelector('[name="q"]')?.focus(), 40); notificar('Digite uma busca e use Busca Profunda para consultar as três fontes.'); }
  }
  if (acao === 'abrir-busca') { renderHome(); setTimeout(() => document.querySelector('[name="q"]')?.focus(), 40); }
  if (acao === 'alternar-movimento') {
    estado.movimento = !estado.movimento;
    window.dispatchEvent(new CustomEvent('biblioteca:movimento', { detail: estado.movimento }));
    notificar(estado.movimento ? 'Animação 3D ativada.' : 'Animação 3D pausada.');
  }
  if (acao === 'menu') document.body.classList.toggle('menu-aberto');
});

modal.addEventListener('click', e => { if (e.target === modal) fecharModal(); });
window.addEventListener('hashchange', () => { document.body.classList.remove('menu-aberto'); rota(); });
rota();
