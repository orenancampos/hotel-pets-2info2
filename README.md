# PetSchool

Cadastro de tutores e pets com Vue, Bootstrap, Fetch API e JSON Server.
Inclui busca de tutores, formulário completo com máscaras e validação,
detalhes do tutor, cadastro de pets vinculados, remoção protegida de tutores
e reservas com controle de vagas por período.

As listagens possuem uma pesquisa única por nome, CPF ou telefone, com resultados
atualizados durante a digitação. Em Pets e Reservas, também é possível localizar
os registros pelo nome, CPF ou telefone do tutor vinculado. O botão Limpar pesquisa
volta a exibir todos os registros. A pesquisa das reservas mantém o cálculo de
ocupação com todas as reservas confirmadas.

## Tecnologias

- Vue.js 3;
- Vite;
- Vue Router;
- Bootstrap 5;
- Bootstrap Icons;
- Fetch API;
- JSON Server.

## Pré-requisitos

Antes de iniciar, verifique se estão instalados:

- [Node.js](https://nodejs.org/);
- npm;
- [Git](https://git-scm.com/);
- [Visual Studio Code](https://code.visualstudio.com/), recomendado.

O projeto utiliza o Node.js `22.18.0`, definido no arquivo `.nvmrc`.

```bash
node --version
npm --version
git --version
```

Caso utilize NVM no Linux ou macOS:

```bash
nvm install
nvm use
```

No Windows com `nvm-windows`:

```powershell
nvm install 22.18.0
nvm use 22.18.0
```

## Instalação

Clone o repositório:

```bash
git clone URL-DO-REPOSITORIO
```

Acesse o diretório e instale as dependências:

```bash
cd nome-do-projeto
npm install
```

## Execução

Em um terminal, inicie a API que persiste os dados em `db.json`:

```bash
npm run api
```

A API utiliza `http://localhost:3000`. Em outro terminal, inicie a aplicação:

```bash
npm run dev
```

O terminal apresentará o endereço local da aplicação, normalmente:

```text
http://localhost:5173
```

As telas estão disponíveis em `/pets`, `/pets/novo`, `/pets/:id`, `/tutores`,
`/tutores/novo`, `/tutores/:id` e `/reservas`. Mantenha os dois terminais em execução.

Para utilizar outro endereço de API, defina `VITE_API_URL` em `.env.local`
e reinicie o servidor de desenvolvimento. Exemplo:

```dotenv
VITE_API_URL=http://localhost:3000
```

Somente nome e telefone são obrigatórios no cadastro de tutor. Os demais campos
são opcionais e validados quando preenchidos. Para remover um tutor, remova seus
pets vinculados ou transfira os vínculos previamente.

Em **Reservas**, selecione o pet e as datas de entrada e saída. O hotel começa
com **20 vagas**, e a capacidade pode ser alterada nessa mesma tela. A saída
libera a vaga para outra entrada no mesmo dia. Reservas canceladas ou finalizadas
deixam de ocupar vagas. O sistema também impede reservas sobrepostas para o mesmo
pet e a redução da capacidade abaixo das reservas ativas.

O comando `npm run api` utiliza o JSON Server com validações de disponibilidade
antes de gravar reservas em `db.json`, inclusive quando chegam solicitações
simultâneas. Reinicie a API após atualizar o projeto para ativar essas regras.

Outros comandos disponíveis:

```bash
npm run format
npm run lint
npm test
npm run build
npm run preview
```

## Estrutura do projeto

A aplicação organiza páginas, componentes, serviços, rotas e estilos por
responsabilidade.

Consulte o [guia de estrutura do projeto](./docs/estrutura-projeto.md).

## Documentação

- [Como utilizar o template](./docs/como-utilizar-template.md);
- [Estrutura do projeto](./docs/estrutura-projeto.md);
- [Guia de padronização do código](./docs/guia-padronizacao-codigo.md);
- [Validação do projeto](./docs/validacao-template.md).

## Contribuição

Para contribuir:

1. faça um fork, caso não possua acesso direto ao repositório;
2. clone o repositório ou seu fork;
3. crie uma branch para a alteração;
4. desenvolva e teste a funcionalidade;
5. execute a formatação, o lint e o build;
6. crie um commit com uma mensagem descritiva;
7. envie a branch ao GitHub;
8. abra um Pull Request.

```bash
git switch -c feat/nome-da-funcionalidade
npm run format
npm run lint
npm run build
git add .
git commit -m "feat: adiciona nova funcionalidade"
git push origin feat/nome-da-funcionalidade
```

## Origem do template

Este projeto foi iniciado a partir do
[Template Vue.js com Bootstrap](https://github.com/ifc-dev-web2/tec-vue-bootstrap-template),
desenvolvido pelo
[Prof. Cristofer Sousa](https://github.com/cristofersousa) para atividades de
Desenvolvimento Web do Instituto Federal Catarinense — Campus Araquari.

## Licença

Consulte os termos de utilização no arquivo [LICENSE](LICENSE).
