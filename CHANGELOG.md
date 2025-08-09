# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [0.5.0] - 2024-01-09

### ✨ Adicionado
- **Sistema de Cache Inteligente**
  - Cache em memória com TTL configurável
  - Cache por tags para invalidação em grupo
  - Otimização de performance para projeções e sugestões
  - Limpeza automática de entradas expiradas

- **SSE para Importação de CSV**
  - Server-Sent Events para progresso em tempo real
  - Importação de clientes e metas via CSV
  - Validação de arquivos CSV antes da importação
  - Templates CSV para download
  - Histórico de importações

- **Sistema Completo de Seguros**
  - CRUD completo para apólices de seguro
  - 7 tipos de seguro (vida, invalidez, saúde, auto, residencial, viagem, outros)
  - 4 status (ativo, inativo, expirado, cancelado)
  - Gestão de beneficiários com validação
  - Resumos estatísticos por cliente
  - Atualização automática de apólices expiradas

- **Histórico Avançado de Simulações**
  - Salvamento com metadados (nome, descrição, tags)
  - Comparação de múltiplas simulações
  - Estatísticas detalhadas por cliente
  - Filtros e ordenação avançados

- **Otimizações de Performance**
  - Rate limiting (100 req/min)
  - Índices de banco de dados otimizados
  - Cache inteligente para consultas frequentes
  - Paginação otimizada

- **Documentação Swagger Completa**
  - Interface interativa em `/docs`
  - Documentação automática de todos os endpoints
  - Exemplos de uso e schemas

### 🧪 Testes
- **40+ novos testes** para todas as funcionalidades
- **Total de 100+ testes** passando (95%+)
- **Cobertura de 70.15%** (melhoria significativa)
- Testes para cache, importação, seguros e histórico
- Testes de performance e rate limiting

### 📚 Documentação
- **Guia completo de deploy** (DEPLOY.md)
- **Documentação Swagger** ativa
- **Exemplos de uso** atualizados
- **Guias de troubleshooting**

### 🔧 Infraestrutura
- Compatibilidade ESM resolvida
- Import dinâmico para plugins Fastify
- Configuração de produção otimizada
- Scripts de backup e monitoramento

### 🛡️ Segurança
- Rate limiting implementado
- Validação robusta de uploads
- Sanitização de dados CSV
- Headers de segurança

## [0.3.0] - 2024-01-09

### ✨ Adicionado
- **Motor de Projeção Patrimonial completo**
  - Função `simulateWealthCurve` com crescimento composto mensal
  - Taxa padrão de 4% a.a. (configurável)
  - Suporte a eventos financeiros únicos, mensais e anuais
  - Projeções de longo prazo até 2060
  - Cálculo preciso com arredondamento para 2 casas decimais

- **Sistema de Sugestões Automáticas**
  - Análise de viabilidade das metas financeiras
  - 5 tipos de sugestões inteligentes:
    - Aumentar contribuição mensal
    - Estender prazo da meta
    - Ajustar valor da meta
    - Otimizar alocação de ativos
    - Reduzir despesas
  - Priorização automática (alta/média/baixa)
  - Simulação de impacto das sugestões
  - Categorização por tipo de ação

- **14 novos endpoints implementados**
  - **7 endpoints de projeções**: simulação, projeção de clientes, salvamento
  - **7 endpoints de sugestões**: análise, impacto, categorização
  - Validação Zod em todos os endpoints
  - Autorização baseada em roles

- **Serviços de negócio estruturados**
  - `ProjectionService`: cálculos de projeção patrimonial
  - `SuggestionService`: geração inteligente de sugestões
  - Arquitetura modular e escalável

### 🧪 Testes
- **15 novos testes** para projeções e sugestões
- **Total de 34 testes** passando (100%)
- **Cobertura de 79.32%** (próximo ao objetivo de 80%)
- Testes de integração com cenários reais
- Validação de cálculos matemáticos

### 📚 Documentação
- Atualizado README.md com novos endpoints
- Atualizado DOCUMENTACAO.md com detalhes técnicos
- Exemplos de uso das novas funcionalidades

### 🔧 Infraestrutura
- Configuração Jest corrigida para ESM
- Estrutura de serviços implementada
- Validações Zod expandidas

## [0.2.0] - 2024-01-09

### ✨ Adicionado
- **Sistema de Autenticação JWT completo**
  - Registro de usuários com validação
  - Login com geração de token JWT
  - Middleware de autenticação para rotas protegidas
  - Endpoint de perfil do usuário (`/api/auth/me`)

- **Sistema de Autorização baseado em Roles**
  - Role `advisor`: acesso completo (leitura e escrita)
  - Role `viewer`: acesso somente leitura
  - Middleware de autorização por endpoint

- **CRUD completo de Clientes**
  - Listagem com paginação (`GET /api/clients`)
  - Busca por ID com dados relacionados (`GET /api/clients/:id`)
  - Atualização (apenas advisors) (`PUT /api/clients/:id`)
  - Exclusão (apenas advisors) (`DELETE /api/clients/:id`)

- **Validação robusta com Zod v4**
  - Schemas de validação para todos os endpoints
  - Middleware de validação customizado
  - Tratamento de erros de validação consistente

- **Segurança implementada**
  - Hash de senhas com bcrypt (salt rounds: 10)
  - Tokens JWT com payload customizado
  - Validação de entrada em todos os endpoints

- **Testes automatizados**
  - 19 testes unitários com Jest e Supertest
  - Cobertura de 80.11% (acima do objetivo de 80%)
  - Testes de autenticação e CRUD de clientes
  - Testes de autorização (advisor vs viewer)
  - Limpeza automática do banco entre testes

- **Infraestrutura melhorada**
  - Servidor Fastify configurado na porta 3000
  - Health check endpoint (`/health`)
  - Logs estruturados do Fastify
  - CORS configurado para desenvolvimento

### 🔧 Alterado
- Atualizado `package.json` com novas dependências
- Configurado `tsconfig.json` para incluir testes
- Melhorado `docker-compose.yml` para desenvolvimento

### 📚 Documentação
- Atualizado `README.md` com instruções completas
- Atualizado `DOCUMENTACAO.md` com detalhes técnicos
- Adicionado `CHANGELOG.md` para rastrear mudanças

### 🧪 Testes
- Configurado Jest com suporte a ESM e TypeScript
- Implementados testes para autenticação
- Implementados testes para CRUD de clientes
- Configurada cobertura de código

## [0.1.0] - 2024-01-08

### ✨ Adicionado
- **Configuração inicial do projeto**
  - Estrutura base com TypeScript e Fastify
  - Configuração do Prisma ORM
  - Modelos de dados definidos no schema
  - Docker Compose para PostgreSQL
  - ESLint e Prettier configurados

- **Modelos de dados Prisma**
  - Client (usuários/clientes)
  - Goal (metas financeiras)
  - Wallet (carteiras de investimento)
  - Event (eventos financeiros)
  - Simulation (simulações)
  - InsuranceProfile (perfis de seguro)

- **Infraestrutura base**
  - Servidor Fastify básico
  - Plugin Prisma para integração
  - Configuração de CORS
  - Scripts de desenvolvimento

### 📚 Documentação
- README.md inicial
- DOCUMENTACAO.md com visão geral
- Plano de ação de 5 dias definido

---

## Legenda

- ✨ **Adicionado**: para novas funcionalidades
- 🔧 **Alterado**: para mudanças em funcionalidades existentes
- 🐛 **Corrigido**: para correções de bugs
- 🗑️ **Removido**: para funcionalidades removidas
- 🔒 **Segurança**: para correções de vulnerabilidades
- 📚 **Documentação**: para mudanças na documentação
- 🧪 **Testes**: para adições ou mudanças em testes
