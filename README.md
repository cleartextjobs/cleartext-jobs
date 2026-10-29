# Cleartext Jobs

Site de vagas de IT na Europa, recolhidas automaticamente das páginas públicas de recrutamento das empresas. Cada vaga mostra o salário quando a empresa o publica e tem um link para o anúncio original.

## Como funciona

1. **Recolha** (`src/collect.mjs`): várias vezes por dia, o programa lê as vagas públicas de:
   - empresas que usam **Greenhouse**, **Lever**, **Ashby**, **Recruitee** ou **SmartRecruiters** (a lista está em `config/sources.json`);
   - **Arbeitnow**, uma API gratuita de vagas na Europa, que pede um link de volta (o site mostra "via Arbeitnow").
2. **Filtros** (`src/normalize.mjs`): fica só com funções de IT, localizadas na Europa (ou remotas para a Europa), com menos de 120 dias. Lê o salário dos dados da empresa ou do texto do anúncio, deteta o modelo de trabalho (remoto, híbrido, presencial), o nível e as tecnologias, e elimina repetidos.
3. **Site** (`site/index.html`): uma página com pesquisa e filtros, que lê o ficheiro `site/jobs.json` gerado pela recolha. Não guarda dados pessoais nem recebe candidaturas.
4. **Publicação** (`.github/workflows/update.yml`): o GitHub corre a recolha a cada 6 horas e publica o site no GitHub Pages.

Não há texto dos anúncios no site, só os dados factuais (função, empresa, local, salário, tecnologias) e o link para o original.

## Publicar o site (uma vez, cerca de 20 minutos)

1. Criar uma conta gratuita em [github.com](https://github.com).
2. Criar um repositório novo, **público**, chamado por exemplo `cleartext-jobs` (o GitHub Pages é gratuito em repositórios públicos).
3. Carregar todos os ficheiros desta pasta para o repositório (botão **Add file → Upload files**, arrastando a pasta; confirmar que a pasta `.github` também foi carregada).
4. Em **Settings → Pages**, em *Build and deployment*, escolher **Source: GitHub Actions**.
5. Em **Actions**, abrir *Update jobs and publish site* e carregar em **Run workflow**. Ao fim de 2 a 3 minutos o site fica disponível em `https://<utilizador>.github.io/cleartext-jobs/`.
6. A partir daí atualiza-se sozinho a cada 6 horas.

### Ligar o domínio cleartextjobs.com

1. Registar o domínio num registador.
2. No repositório, em **Settings → Pages → Custom domain**, escrever `cleartextjobs.com` e guardar.
3. No registador, criar os registos DNS que o GitHub indica nessa página (registos A para o domínio principal e CNAME para `www`).
4. Quando o certificado estiver ativo, marcar **Enforce HTTPS**.

## Manutenção

- **Acrescentar empresas:** em `config/sources.json`, juntar o nome da empresa na lista certa. O nome é o que aparece no endereço da página de vagas: `boards.greenhouse.io/<nome>`, `jobs.lever.co/<nome>`, `jobs.ashbyhq.com/<nome>`, `<nome>.recruitee.com` ou `jobs.smartrecruiters.com/<Nome>` (no SmartRecruiters, maiúsculas e minúsculas contam). Se o nome estiver errado, a recolha ignora-o e indica-o no registo da execução (separador **Actions**).
- **Nome de empresa mal escrito no site:** acrescentar em `names`, no mesmo ficheiro.
- **Se uma execução falhar:** o site anterior continua no ar. O registo da execução em **Actions** mostra o motivo.

## Receber pagamentos (destaques)

O site tem uma secção "Feature a job" e um link no topo da página. A empresa paga para a vaga ficar em destaque durante 30 dias.

1. **Contacto e preço:** em `config/site.json`, escrever o email de contacto em `contactEmail`. O preço por omissão é €49 por 30 dias.
2. **Link de pagamento (opcional):** criar um link de pagamento numa plataforma como o Stripe (sem mensalidade, só uma comissão por venda) e colá-lo em `paymentLink`. Sem link, a empresa escreve para o email e recebe o link ou a fatura.
3. **Quando uma empresa paga:**
   - se a vaga já está no site, acrescentar o link da vaga original e a data final em `config/featured.json`, na lista `featured`;
   - se a empresa não está nas fontes, acrescentar a vaga completa na lista `direct` (há um exemplo no ficheiro). O salário é obrigatório.
4. Na execução seguinte (até 6 horas, ou logo com **Run workflow**), a vaga aparece no topo com a etiqueta "Featured". Quando passa a data final, deixa de estar em destaque sozinha.

Antes de cobrar, confirmar com o contabilista como faturar (atividade aberta e IVA).

## Testar no computador (opcional)

Com o Node.js 20 ou mais recente instalado:

```
node test/run.mjs        # verifica as regras de filtragem
node src/collect.mjs     # recolhe as vagas para site/jobs.json
npx serve site           # abre o site em http://localhost:3000
```

## Limites conhecidos

- Só aparecem empresas que usam Greenhouse, Lever, Ashby, Recruitee ou SmartRecruiters (e as vagas do Arbeitnow). Empresas com sistemas próprios, Workday ou Workable não estão incluídas. Várias tecnológicas portuguesas conhecidas (Talkdesk, OutSystems, Unbabel, Uphold) não foram encontradas nestes sistemas no teste de 27/10/2026.
- Nas empresas industriais grandes (Bosch, Continental), só entram funções com sinais claros de IT no título; algumas vagas técnicas de fronteira podem ficar de fora.
- A classificação de funções é feita por palavras no título. Algumas vagas podem ficar na área errada ou escapar.
- No teste de 27/10/2026: 2.290 vagas de IT, 370 empresas, cerca de 17% com salário publicado; 227 em Portugal e 300 em Espanha.
- LinkedIn, Indeed, ITJobs e outros sites de emprego não são usados, porque os termos proíbem a recolha automática. Remotive também não, porque não permite colocar as vagas noutros sites de emprego.

## Publicação automática no Facebook e no Instagram

`.github/workflows/social.yml` publica às segundas (vagas em Portugal), quartas (remotas na Europa) e sextas (Portugal e Espanha), às 08:43 UTC. Escolhe 5 vagas recentes com salário, uma por empresa (`src/social.mjs`):

- **Facebook:** texto com as 5 vagas e link para cleartextjobs.com.
- **Instagram:** carrossel de 7 imagens (capa, 5 vagas, fecho) gerado por `src/render.mjs` e publicado no site em `social/<data>/` para o Instagram o ir buscar; a legenda remete para o link na bio.
- O Instagram tem de estar ligado à Página do Facebook (já está: @cleartextjobs).
- Precisa de dois segredos no repositório (**Settings → Secrets and variables → Actions**): `FB_PAGE_ID` e `FB_PAGE_TOKEN` (chave da Página, de uma app da Meta em modo Live, com as autorizações `pages_manage_posts`, `pages_read_engagement`, `pages_show_list`, `instagram_basic` e `instagram_content_publish`).
- Para testar: **Actions → Post jobs to Facebook and Instagram → Run workflow**, com `dry_run = true` (cria o texto e as imagens, que ficam para descarregar em *Artifacts*, sem publicar) ou `false` (publica).
- Se a chave deixar de funcionar (por exemplo, depois de mudar a palavra-passe do Facebook), a execução falha e mostra o erro da Meta; é preciso gerar uma chave nova.
- Letras: Instrument Sans e Martian Mono, licença SIL Open Font License (ficheiros em `assets/fonts`).
