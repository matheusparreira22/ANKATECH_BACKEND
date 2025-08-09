# ANKATECH_BACKEND - Documentação do Projeto

## Visão Geral
Este projeto é uma API backend para planejamento financeiro e gestão patrimonial, desenvolvida em Node.js com TypeScript, utilizando o framework Fastify. O sistema oferece funcionalidades completas de autenticação, autorização baseada em roles, gerenciamento de clientes, metas financeiras, carteiras, eventos e simulações.

## Principais Tecnologias Utilizadas
- **Node.js 20** + **TypeScript**
- **Fastify 4** (framework web)
- **Prisma ORM** (acesso ao banco de dados PostgreSQL 15)
- **JWT** (autenticação e autorização)
- **Zod v4** (validação de dados)
- **bcrypt** (hash de senhas)
- **Jest** + **Supertest** (testes unitários)
- **ESLint** (formatação de código)
- **Docker Compose** (containerização)

## Estrutura de Pastas
```
src/
├── index.ts                 # Servidor principal Fastify
├── libs/
│   ├── prisma.ts           # Plugin Prisma para Fastify
│   ├── auth.ts             # Middleware de autenticação JWT
│   └── validation.ts       # Utilitários de validação Zod
├── routes/
│   ├── auth.ts             # Rotas de autenticação
│   ├── clients.ts          # CRUD de clientes
│   ├── goals.ts            # CRUD de metas (preparado)
│   ├── wallet.ts           # CRUD de carteiras (preparado)
│   └── events.ts           # CRUD de eventos (preparado)
├── schemas/
│   └── index.ts            # Schemas Zod para validação
└── services/               # Serviços de negócio (futuro)

prisma/
├── schema.prisma           # Modelos de dados
└── migrations/             # Migrações do banco

tests/
├── auth.test.ts            # Testes de autenticação
├── clients.test.ts         # Testes de clientes
└── setup.ts                # Configuração de testes

docker-compose.yml          # PostgreSQL containerizado
```

## Modelos de Dados (Prisma)

### **Client** (Usuário/Cliente)
- `id`: Identificador único (CUID)
- `name`: Nome completo
- `email`: Email único para login
- `password`: Senha hasheada (bcrypt)
- `role`: Papel no sistema (`advisor` | `viewer`)
- `age`: Idade (opcional)
- `status`: Status ativo/inativo
- `perfilFamilia`: Perfil familiar (opcional)
- Relacionamentos: goals, wallet, events, simulations, insuranceProfile

### **Goal** (Metas Financeiras)
- `id`: Identificador único
- `clientId`: Referência ao cliente
- `type`: Tipo da meta
- `amount`: Valor alvo (Decimal)
- `targetAt`: Data alvo
- `createdAt`: Data de criação

### **Wallet** (Carteira de Investimentos)
- `id`: Identificador único
- `clientId`: Referência ao cliente (único)
- `totalValue`: Valor total da carteira (Decimal)
- `allocation`: Alocação por classe de ativo (JSON)

### **Event** (Eventos Financeiros)
- `id`: Identificador único
- `clientId`: Referência ao cliente
- `type`: Tipo do evento
- `value`: Valor do evento (Decimal)
- `frequency`: Frequência (opcional)
- `date`: Data do evento (opcional)

### **Simulation** (Simulações)
- `id`: Identificador único
- `clientId`: Referência ao cliente
- `payload`: Dados da simulação (JSON)
- `createdAt`: Data de criação

### **InsuranceProfile** (Perfil de Seguro)
- `id`: Identificador único
- `clientId`: Referência ao cliente (único)
- `type`: Tipo de seguro
- `details`: Detalhes do seguro (JSON)

## Funcionalidades Implementadas

### 🔐 **Sistema de Autenticação e Autorização**
- **Registro de usuários** com validação de dados
- **Login com JWT** e hash de senhas (bcrypt)
- **Middleware de autenticação** para rotas protegidas
- **Sistema de roles**:
  - `advisor`: Acesso completo (leitura e escrita)
  - `viewer`: Acesso somente leitura
- **Endpoint de perfil** (`/api/auth/me`)

### 👥 **Gerenciamento de Clientes**
- **CRUD completo** para clientes
- **Listagem com paginação** (`page`, `limit`)
- **Busca por ID** com dados relacionados
- **Atualização** (apenas advisors)
- **Exclusão** (apenas advisors)
- **Validação robusta** com Zod v4

### 🛡️ **Segurança e Validação**
- **Senhas hasheadas** com bcrypt (salt rounds: 10)
- **Tokens JWT** com payload customizado
- **Validação de entrada** com Zod em todos endpoints
- **Tratamento de erros** consistente
- **Middleware de autorização** baseado em roles

### 🔮 **Motor de Projeção Patrimonial**
- **Simulação de crescimento composto** mensal até 2060
- **Taxa padrão de 4% a.a.** (configurável)
- **Suporte a eventos financeiros** (únicos, mensais, anuais)
- **Projeções precisas** com arredondamento para 2 casas decimais
- **Cálculo de retorno total** e valor final

### 💡 **Sistema de Sugestões Automáticas**
- **Análise de viabilidade** das metas financeiras
- **5 tipos de sugestões** inteligentes:
  - Aumentar contribuição mensal
  - Estender prazo da meta
  - Ajustar valor da meta
  - Otimizar alocação de ativos
  - Reduzir despesas
- **Priorização automática** (alta/média/baixa)
- **Simulação de impacto** das sugestões
- **Categorização** por tipo de ação

### 🏗️ **Infraestrutura**
- **Servidor Fastify** rodando na porta 3000
- **Banco PostgreSQL 15** via Docker Compose
- **Prisma ORM** com migrações automáticas
- **CORS** configurado para desenvolvimento
- **Logs estruturados** do Fastify
- **Health check** endpoint (`/health`)

## 🧪 **Testes Implementados**
- **34 testes unitários** com Jest e Supertest
- **Cobertura de 79.32%** (próximo ao objetivo de 80%)
- **Testes de autenticação**: registro, login, perfil, validações
- **Testes de clientes**: CRUD, paginação, autorização
- **Testes de projeções**: simulações, cálculos, validações
- **Testes de sugestões**: análise, impacto, categorização
- **Limpeza automática** do banco entre testes
- **Configuração ESM** com TypeScript

### Executar Testes
```bash
npm test                    # Executar todos os testes
npm test -- --coverage     # Executar com relatório de cobertura
npm test -- --watch        # Executar em modo watch
```

## 📡 **API Endpoints**

### **Autenticação** (`/api/auth`)
```
POST /api/auth/register     # Registrar usuário
POST /api/auth/login        # Login
GET  /api/auth/me          # Perfil do usuário logado
```

### **Clientes** (`/api/clients`)
```
GET    /api/clients         # Listar clientes (paginado)
GET    /api/clients/:id     # Buscar cliente por ID
PUT    /api/clients/:id     # Atualizar cliente (advisor only)
DELETE /api/clients/:id     # Deletar cliente (advisor only)
```

### **Projeções** (`/api/projections`) ✅ **IMPLEMENTADO**
```
GET    /api/projections/client/:id              # Projeção completa do cliente
GET    /api/projections/client/:id/annual       # Projeção anual simplificada
POST   /api/projections/simulate                # Simulação com parâmetros customizados
POST   /api/projections/client/:id/save         # Salvar simulação
GET    /api/projections/client/:id/simulations  # Listar simulações salvas
GET    /api/projections/simulations/:id         # Obter simulação específica
DELETE /api/projections/simulations/:id         # Deletar simulação
```

### **Sugestões** (`/api/suggestions`) ✅ **IMPLEMENTADO**
```
GET    /api/suggestions/client/:id                    # Análise completa e sugestões
GET    /api/suggestions/client/:id/summary            # Resumo das sugestões
GET    /api/suggestions/client/:id/alignment          # Análise de alinhamento
POST   /api/suggestions/client/:id/simulate           # Simular impacto de sugestão
GET    /api/suggestions/client/:id/category/:category # Sugestões por categoria
GET    /api/suggestions/stats                         # Estatísticas gerais
```

### **Utilitários**
```
GET /health                 # Health check
```

## 🚀 **Scripts Disponíveis**
```bash
npm run dev                 # Servidor em desenvolvimento (tsx watch)
npm run build              # Compilar TypeScript
npm start                  # Executar servidor compilado
npm run prisma:migrate     # Executar migrações do banco
npm test                   # Executar testes
npm run lint               # Verificar código com ESLint
```

## 🐳 **Docker e Banco de Dados**
```bash
docker-compose up -d       # Subir PostgreSQL
docker-compose down        # Parar containers
```

**Configuração do Banco:**
- Host: `localhost:5432`
- Database: `plannerdb`
- User: `planner`
- Password: `plannerpw`

## 📊 **Métricas de Qualidade**
- ✅ **Cobertura de Testes**: 79.32%
- ✅ **Testes Passando**: 34/34 (100%)
- ✅ **Endpoints Funcionais**: 21 endpoints implementados
- ✅ **TypeScript**: Strict mode habilitado
- ✅ **ESLint**: Configurado com Prettier
- ✅ **Segurança**: JWT + bcrypt + validação

## 🔄 **Status do Desenvolvimento**
- ✅ **Dia 1**: Configuração inicial e arquitetura
- ✅ **Dia 2**: Autenticação, CRUD de clientes, testes
- ✅ **Dia 3**: Motor de projeção patrimonial e sistema de sugestões
- ⏳ **Dia 4**: SSE para importação de CSV (próximo)

## 🛠️ **Próximos Passos**
1. ✅ ~~Implementar motor de projeção patrimonial~~ **CONCLUÍDO**
2. ✅ ~~Desenvolver sistema de sugestões automáticas~~ **CONCLUÍDO**
3. Adicionar SSE para importação de CSV (Dia 4)
4. Implementar histórico de simulações (Dia 5)
5. Completar CRUD de goals, wallet e events
6. Adicionar documentação Swagger automática

---

## 📞 **Suporte**
Para dúvidas ou contribuições, consulte o README.md ou entre em contato com o responsável pelo projeto.
