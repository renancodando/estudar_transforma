const TEMPO_LIMITE = 8000;

function normalizarTexto(valor = "") {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function buscarJson(url, opcoes = {}) {
  const controlador = new AbortController();
  const timer = setTimeout(() => controlador.abort(), TEMPO_LIMITE);
  try {
    const resposta = await fetch(url, { ...opcoes, signal: controlador.signal });
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    return await resposta.json();
  } finally {
    clearTimeout(timer);
  }
}

function maiorCapaGoogle(links = {}) {
  return links.extraLarge || links.large || links.medium || links.small || links.thumbnail || links.smallThumbnail || "";
}

function limparUrlGoogle(url = "") {
  return url.replace(/^http:/, "https:").replace(/&edge=curl(&|$)/, "$1");
}

function obterIsbn(identificadores = []) {
  const isbn13 = identificadores.find(x => x.type === "ISBN_13");
  const isbn10 = identificadores.find(x => x.type === "ISBN_10");
  return isbn13?.identifier || isbn10?.identifier || "";
}

export async function buscarGoogle(termo, limite = 20) {
  const url = new URL("https://www.googleapis.com/books/v1/volumes");
  url.searchParams.set("q", termo);
  url.searchParams.set("maxResults", String(Math.min(limite, 40)));
  url.searchParams.set("printType", "books");
  const dados = await buscarJson(url);
  return (dados.items || []).map(item => {
    const v = item.volumeInfo || {};
    const a = item.accessInfo || {};
    return {
      id: `google:${item.id}`,
      idGoogle: item.id,
      titulo: v.title || "Sem título",
      subtitulo: v.subtitle || "",
      autores: v.authors || [],
      ano: (v.publishedDate || "").slice(0, 4),
      descricao: v.description || "",
      idioma: v.language || "",
      isbn: obterIsbn(v.industryIdentifiers),
      capa: limparUrlGoogle(maiorCapaGoogle(v.imageLinks)),
      fontePrimaria: "Google Books",
      fontes: ["Google Books"],
      assunto: v.categories || [],
      paginas: v.pageCount || null,
      avaliacao: v.averageRating || null,
      quantidadeAvaliacoes: v.ratingsCount || null,
      dominioPublico: false,
      leituraOnline: Boolean(a.webReaderLink || v.previewLink),
      links: {
        google: a.webReaderLink || v.previewLink || v.infoLink || "",
        detalheGoogle: v.infoLink || "",
        openlibrary: "",
        gutenberg: ""
      },
      formatos: {
        pdf: a.pdf?.isAvailable ? (a.pdf.downloadLink || "") : "",
        epub: a.epub?.isAvailable ? (a.epub.downloadLink || "") : "",
        html: a.webReaderLink || "",
        texto: ""
      },
      origem: item
    };
  });
}

export async function buscarOpenLibrary(termo, limite = 20) {
  const url = new URL("https://openlibrary.org/search.json");
  url.searchParams.set("q", termo);
  url.searchParams.set("limit", String(Math.min(limite, 50)));
  url.searchParams.set("fields", "key,title,author_name,first_publish_year,cover_i,isbn,language,ebook_access,ia,public_scan_b,edition_key,subject");
  const dados = await buscarJson(url);
  return (dados.docs || []).map(doc => {
    const ia = Array.isArray(doc.ia) ? doc.ia[0] : "";
    const acessoPublico = doc.ebook_access === "public" || doc.public_scan_b === true;
    return {
      id: `openlibrary:${doc.key}`,
      idOpenLibrary: doc.key,
      titulo: doc.title || "Sem título",
      subtitulo: "",
      autores: doc.author_name || [],
      ano: doc.first_publish_year ? String(doc.first_publish_year) : "",
      descricao: "",
      idioma: Array.isArray(doc.language) ? doc.language[0] : "",
      isbn: Array.isArray(doc.isbn) ? (doc.isbn.find(x => String(x).length === 13) || doc.isbn[0] || "") : "",
      capa: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : "",
      fontePrimaria: "Open Library",
      fontes: ["Open Library"],
      assunto: doc.subject || [],
      paginas: null,
      avaliacao: null,
      quantidadeAvaliacoes: null,
      dominioPublico: acessoPublico,
      leituraOnline: Boolean(ia || acessoPublico),
      links: {
        google: "",
        openlibrary: `https://openlibrary.org${doc.key}`,
        gutenberg: "",
        archive: ia ? `https://archive.org/details/${ia}` : ""
      },
      formatos: { pdf: "", epub: "", html: ia ? `https://archive.org/details/${ia}` : "", texto: "" },
      origem: doc
    };
  });
}

function formatoGutendex(formatos, prefixo) {
  const entradas = Object.entries(formatos || {});
  const exata = entradas.find(([tipo]) => tipo === prefixo);
  if (exata) return exata[1];
  const semelhante = entradas.find(([tipo]) => tipo.startsWith(prefixo));
  return semelhante?.[1] || "";
}

export async function buscarGutendex(termo, limite = 20) {
  const url = new URL("https://gutendex.com/books/");
  url.searchParams.set("search", termo);
  const dados = await buscarJson(url);
  return (dados.results || []).slice(0, limite).map(livro => ({
    id: `gutendex:${livro.id}`,
    idGutendex: livro.id,
    titulo: livro.title || "Sem título",
    subtitulo: "",
    autores: (livro.authors || []).map(a => a.name),
    ano: "",
    descricao: "",
    idioma: (livro.languages || [""])[0],
    isbn: "",
    capa: formatoGutendex(livro.formats, "image/jpeg"),
    fontePrimaria: "Project Gutenberg",
    fontes: ["Project Gutenberg"],
    assunto: [...(livro.subjects || []), ...(livro.bookshelves || [])],
    paginas: null,
    avaliacao: null,
    quantidadeAvaliacoes: null,
    dominioPublico: true,
    leituraOnline: Boolean(formatoGutendex(livro.formats, "text/html") || formatoGutendex(livro.formats, "text/plain")),
    links: {
      google: "",
      openlibrary: "",
      gutenberg: `https://www.gutenberg.org/ebooks/${livro.id}`
    },
    formatos: {
      pdf: formatoGutendex(livro.formats, "application/pdf"),
      epub: formatoGutendex(livro.formats, "application/epub+zip"),
      html: formatoGutendex(livro.formats, "text/html"),
      texto: formatoGutendex(livro.formats, "text/plain")
    },
    origem: livro
  }));
}

function chaveLivro(livro) {
  const titulo = normalizarTexto(livro.titulo).replace(/\b(edicao|edition|volume|vol)\b.*$/i, "").trim();
  const autor = normalizarTexto(livro.autores?.[0] || "").split(" ").slice(-2).join(" ");
  return `${titulo}|${autor}`;
}

function pontuacaoLivro(livro) {
  let p = 0;
  if (livro.capa) p += 3;
  if (livro.descricao) p += 2;
  if (livro.isbn) p += 1;
  if (livro.leituraOnline) p += 2;
  if (livro.formatos?.pdf) p += 2;
  if (livro.formatos?.epub) p += 2;
  if (livro.dominioPublico) p += 1;
  if (livro.fontePrimaria === "Google Books") p += 1;
  return p;
}

export function mesclarLivros(livros) {
  const mapa = new Map();
  for (const livro of livros) {
    const chave = chaveLivro(livro);
    if (!chave.replace("|", "")) continue;
    const atual = mapa.get(chave);
    if (!atual) {
      mapa.set(chave, structuredClone(livro));
      continue;
    }
    const principal = pontuacaoLivro(livro) > pontuacaoLivro(atual) ? livro : atual;
    const secundario = principal === livro ? atual : livro;
    mapa.set(chave, {
      ...principal,
      id: principal.id,
      capa: principal.capa || secundario.capa,
      descricao: principal.descricao || secundario.descricao,
      ano: principal.ano || secundario.ano,
      idioma: principal.idioma || secundario.idioma,
      isbn: principal.isbn || secundario.isbn,
      fontes: [...new Set([...(principal.fontes || []), ...(secundario.fontes || [])])],
      assunto: [...new Set([...(principal.assunto || []), ...(secundario.assunto || [])])].slice(0, 30),
      dominioPublico: Boolean(principal.dominioPublico || secundario.dominioPublico),
      leituraOnline: Boolean(principal.leituraOnline || secundario.leituraOnline),
      links: { ...(secundario.links || {}), ...(principal.links || {}) },
      formatos: {
        pdf: principal.formatos?.pdf || secundario.formatos?.pdf || "",
        epub: principal.formatos?.epub || secundario.formatos?.epub || "",
        html: principal.formatos?.html || secundario.formatos?.html || "",
        texto: principal.formatos?.texto || secundario.formatos?.texto || ""
      }
    });
  }
  return [...mapa.values()];
}

export async function buscarRapido(termo) {
  const erros = [];
  try {
    const google = await buscarGoogle(termo, 24);
    if (google.length) return { livros: google, modo: "Google Books", erros };
  } catch (erro) { erros.push(`Google Books: ${erro.message}`); }
  try {
    const open = await buscarOpenLibrary(termo, 24);
    if (open.length) return { livros: open, modo: "Open Library", erros };
  } catch (erro) { erros.push(`Open Library: ${erro.message}`); }
  try {
    const gutenberg = await buscarGutendex(termo, 24);
    return { livros: gutenberg, modo: "Project Gutenberg", erros };
  } catch (erro) { erros.push(`Gutendex: ${erro.message}`); }
  return { livros: [], modo: "sem resultados", erros };
}

export async function buscarProfundo(termo) {
  const resultados = await Promise.allSettled([
    buscarGoogle(termo, 24),
    buscarOpenLibrary(termo, 24),
    buscarGutendex(termo, 24)
  ]);
  const livros = [];
  const erros = [];
  const nomes = ["Google Books", "Open Library", "Gutendex"];
  resultados.forEach((r, i) => {
    if (r.status === "fulfilled") livros.push(...r.value);
    else erros.push(`${nomes[i]}: ${r.reason?.message || "indisponível"}`);
  });
  return { livros: mesclarLivros(livros), modo: "busca profunda", erros };
}

export async function enriquecerLivro(livro) {
  const termo = [livro.titulo, livro.autores?.[0]].filter(Boolean).join(" ");
  const consultas = [];
  if (!livro.fontes?.includes("Open Library")) consultas.push(buscarOpenLibrary(termo, 5).catch(() => []));
  if (!livro.fontes?.includes("Project Gutenberg")) consultas.push(buscarGutendex(termo, 5).catch(() => []));
  if (!livro.fontes?.includes("Google Books")) consultas.push(buscarGoogle(termo, 5).catch(() => []));
  const extras = (await Promise.all(consultas)).flat();
  const combinados = mesclarLivros([livro, ...extras]);
  return combinados.find(x => normalizarTexto(x.titulo).includes(normalizarTexto(livro.titulo).slice(0, 18))) || combinados[0] || livro;
}

export async function resolverLivroDoUsuario() {
  const isbn = "9798250199780";
  try {
    const google = await buscarGoogle(`isbn:${isbn}`, 5);
    if (google.length) return { ...google[0], destaqueUsuario: true };
  } catch {}
  try {
    const open = await buscarOpenLibrary(isbn, 5);
    if (open.length) return { ...open[0], destaqueUsuario: true };
  } catch {}
  return {
    id: "usuario:todo-dia-um-bichinho-some",
    titulo: "Todo Dia um Bichinho Some",
    autores: ["Emeric Emeric"],
    ano: "2026",
    descricao: "Em uma antiga casa, uma pequena formiga começa a questionar um mundo de trabalho, promessas e injustiças silenciosas.",
    idioma: "pt",
    isbn,
    capa: "https://i.thriftbooks.com/api/imagehandler/m/19CE7E896C93788857C7078ECD820AC73471E160.jpeg",
    fontePrimaria: "Edição do autor",
    fontes: ["Edição do autor"],
    assunto: ["Literatura", "Sociedade", "Reflexão"],
    dominioPublico: false,
    leituraOnline: false,
    links: {
      google: "",
      openlibrary: "",
      gutenberg: "",
      edicao: "https://www.thriftbooks.com/w/todo-dia-um-bichinho-some-portuguese-edition_emeric-emeric/58770717/item/"
    },
    formatos: { pdf: "", epub: "", html: "", texto: "" },
    destaqueUsuario: true
  };
}
