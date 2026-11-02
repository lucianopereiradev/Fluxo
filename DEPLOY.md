# Deploy do Fluxo na Cloudflare

O Fluxo é publicado como **um único Cloudflare Worker**: ele serve os arquivos do site (pasta
`dist/`) e a API de sincronização em `/api/*`, que usa um banco **D1**. O plano gratuito da
Cloudflare é suficiente.

## Pré-requisitos

- Conta na Cloudflare (gratuita).
- Node 22 LTS e o repositório clonado com as dependências instaladas:

```bash
git clone https://github.com/lucianopereiradev/Fluxo.git
```

```bash
cd Fluxo
```

```bash
npm ci
```

## Opção 1 — Deploy pelo terminal

### 1. Entrar na Cloudflare pelo Wrangler

```bash
npx wrangler login
```

O navegador abre para você autorizar. Confira com:

```bash
npx wrangler whoami
```

### 2. Criar o banco D1

```bash
npx wrangler d1 create fluxo
```

O comando mostra um trecho parecido com:

```jsonc
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "fluxo",
      "database_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    },
  ],
}
```

### 3. Colar o `database_id` no `wrangler.jsonc`

Abra o `wrangler.jsonc` e troque o valor de exemplo
`00000000-0000-0000-0000-000000000000` pelo `database_id` que apareceu no passo anterior.
Os outros campos (`binding: "DB"`, `database_name: "fluxo"`, `migrations_dir`) já estão certos.

> Se o Wrangler perguntar se deve adicionar o banco ao arquivo de configuração, pode aceitar;
> só confira que ficou um único bloco `d1_databases`, com o binding `DB`.

### 4. Aplicar as migrações no banco remoto

```bash
npx wrangler d1 migrations apply fluxo --remote
```

Isso cria a tabela `vaults`. Para conferir:

```bash
npx wrangler d1 execute fluxo --remote --command "SELECT name FROM sqlite_master WHERE type='table'"
```

### 5. Publicar

```bash
npm run deploy
```

O script compila o site (`npm run build`) e publica com `wrangler deploy`. No final, o Wrangler
mostra o endereço, algo como `https://fluxo.<seu-subdominio>.workers.dev`.

> O rate limit usa o binding `RATE_LIMITER` (Workers Rate Limiting), já declarado no
> `wrangler.jsonc`. Se a sua conta não tiver esse recurso, o Worker usa automaticamente um
> limitador simples em memória — o deploy não falha por isso.

### 6. Fazer commit do `database_id`

O `database_id` não é segredo, e deixá-lo no repositório facilita os próximos deploys:

```bash
git add wrangler.jsonc
```

```bash
git commit -m "chore: set production D1 database id"
```

```bash
git push
```

## Opção 2 — Ligar o repositório ao Workers Builds (deploy automático)

Depois de fazer os passos **2, 3, 4 e 6** acima (o banco precisa existir e o `database_id` estar
no repositório):

1. No painel da Cloudflare, vá em **Workers & Pages → Create → Import a repository**.
2. Conecte sua conta do GitHub e escolha `lucianopereiradev/Fluxo`.
3. Configure:
   - **Project name:** `fluxo` (o mesmo `name` do `wrangler.jsonc`)
   - **Build command:** `npm run build`
   - **Deploy command:** `npx wrangler deploy`
   - **Root directory:** `/`
   - Variável de ambiente de build `NODE_VERSION` = `22`
4. Salve. A cada push na `main`, a Cloudflare compila e publica sozinha.

## Como testar depois do deploy

Troque `URL` pelo endereço publicado.

1. **Site:** abra a URL. A landing page deve aparecer; clique em **Try the demo** e navegue
   pelas telas (Visão geral, Lançamentos, Cartões, Relatórios).
2. **API viva:**

```bash
curl -s URL/api/health
```

Deve responder `{"ok":true}`. 3. **Cabeçalhos de segurança:**

```bash
curl -sI URL/
```

Procure `content-security-policy`, `x-content-type-options: nosniff`,
`referrer-policy` e `permissions-policy`. 4. **Sincronização de ponta a ponta:**

- No navegador A, **Começar do zero**, crie uma conta e um lançamento.
- Vá em **Configurações → Sincronização → Criar cofre**, escolha uma frase-senha forte.
- Copie o link de pareamento (ou leia o QR code no celular).
- No navegador B (ou numa janela anônima), abra o link, digite a frase-senha e entre.
- O lançamento do navegador A deve aparecer no B. Edite no B e confira que volta para o A.
- Teste uma frase-senha errada no B: deve aparecer "Frase-senha incorreta".

5. **O servidor não vê seus dados:**

```bash
npx wrangler d1 execute fluxo --remote --command "SELECT id, version, size, substr(hex(blob),1,64) AS inicio FROM vaults"
```

Você verá só bytes aleatórios — nenhum nome, valor ou descrição. 6. **PWA:** no Chrome do celular, use **Adicionar à tela inicial**; depois ative o modo avião e
abra o app — ele deve funcionar offline.

## Problemas comuns

| Sintoma                                    | Causa provável                       | Solução                                                           |
| ------------------------------------------ | ------------------------------------ | ----------------------------------------------------------------- |
| `wrangler deploy` reclama do `database_id` | Ainda está o valor de exemplo        | Refaça o passo 3                                                  |
| Sincronização responde 500                 | Migrações não aplicadas no remoto    | Rode o passo 4 com `--remote`                                     |
| Sincronização responde 403                 | Acesso por outro domínio/origem      | Use o próprio endereço do Worker (a API só aceita a mesma origem) |
| Página antiga depois de publicar           | Service worker com a versão anterior | Aceite o aviso "Há uma nova versão" ou recarregue a página        |

## Remover tudo

```bash
npx wrangler delete fluxo
```

```bash
npx wrangler d1 delete fluxo
```
