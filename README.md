# Biblioteca Livre

Experiência de biblioteca digital com busca híbrida usando Google Books, Open Library e Gutendex/Project Gutenberg.

## Visual Studio
Abra `BibliotecaLivre.sln` e pressione F5.

## Vercel
Defina o diretório raiz do projeto como esta pasta e o Output Directory como `wwwroot`. O projeto é estático no deploy; o host ASP.NET Core existe somente para execução local no Visual Studio.

## APIs
- Google Books: pesquisa principal e metadados.
- Open Library: fallback, capas, edições e disponibilidade.
- Gutendex: obras do Project Gutenberg e formatos de download.

A busca normal mostra resultados do Google Books primeiro e enriquece os principais resultados em segundo plano. Se não houver resultados, cai automaticamente para Open Library e depois Gutendex. O botão Busca profunda consulta as três fontes em paralelo.
