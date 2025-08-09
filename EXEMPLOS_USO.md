# Exemplos de Uso - ANKATECH Backend

Este documento contém exemplos práticos de como usar as funcionalidades implementadas no sistema.

## 🔐 Autenticação

### Registrar um novo usuário
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "João Silva",
    "email": "joao@exemplo.com",
    "password": "senha123",
    "role": "advisor",
    "age": 35
  }'
```

### Fazer login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "joao@exemplo.com",
    "password": "senha123"
  }'
```

**Resposta:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "cme4d06u30000f3x8btx7urtr",
    "email": "joao@exemplo.com",
    "name": "João Silva",
    "role": "advisor"
  }
}
```

## 🔮 Projeções Patrimoniais

### Simular crescimento patrimonial
```bash
curl -X POST http://localhost:3000/api/projections/simulate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN_JWT" \
  -d '{
    "initialValue": 50000,
    "events": [
      {
        "type": "Aporte Mensal",
        "value": 1000,
        "frequency": "monthly"
      },
      {
        "type": "13º Salário",
        "value": 5000,
        "frequency": "yearly"
      }
    ],
    "annualRate": 0.06,
    "endYear": 2040
  }'
```

**Resposta:**
```json
{
  "success": true,
  "data": {
    "initialValue": 50000,
    "finalValue": 892456.78,
    "totalReturn": 842456.78,
    "annualRate": 0.06,
    "projectionPoints": [
      {
        "year": 2024,
        "projectedValue": 65432.10
      },
      {
        "year": 2025,
        "projectedValue": 82145.67
      }
      // ... mais pontos anuais
    ]
  }
}
```

### Obter projeção de um cliente específico
```bash
curl -X GET "http://localhost:3000/api/projections/client/cme4d06u30000f3x8btx7urtr?annualRate=0.05" \
  -H "Authorization: Bearer SEU_TOKEN_JWT"
```

### Salvar simulação para um cliente
```bash
curl -X POST http://localhost:3000/api/projections/client/cme4d06u30000f3x8btx7urtr/save \
  -H "Authorization: Bearer SEU_TOKEN_JWT"
```

## 💡 Sistema de Sugestões

### Obter análise completa e sugestões
```bash
curl -X GET http://localhost:3000/api/suggestions/client/cme4d06u30000f3x8btx7urtr \
  -H "Authorization: Bearer SEU_TOKEN_JWT"
```

**Resposta:**
```json
{
  "success": true,
  "data": {
    "clientId": "cme4d06u30000f3x8btx7urtr",
    "overallAlignment": 65,
    "goals": [
      {
        "id": "goal123",
        "type": "Aposentadoria",
        "amount": 1000000,
        "targetDate": "2040-12-31T00:00:00.000Z",
        "gap": 150000,
        "feasible": false
      }
    ],
    "suggestions": [
      {
        "id": "increase_contribution_goal123",
        "type": "increase_contribution",
        "title": "Aumentar Contribuição Mensal",
        "description": "Para atingir a meta \"Aposentadoria\", aumente sua contribuição mensal em R$ 750 pelos próximos 200 meses.",
        "impact": {
          "monthlyAmount": 750,
          "timeframe": 200,
          "projectedGain": 150000
        },
        "priority": "high",
        "category": "contribution"
      }
    ]
  }
}
```

### Obter resumo das sugestões
```bash
curl -X GET http://localhost:3000/api/suggestions/client/cme4d06u30000f3x8btx7urtr/summary \
  -H "Authorization: Bearer SEU_TOKEN_JWT"
```

### Simular impacto de uma sugestão
```bash
curl -X POST http://localhost:3000/api/suggestions/client/cme4d06u30000f3x8btx7urtr/simulate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN_JWT" \
  -d '{
    "suggestionId": "increase_contribution_001",
    "type": "increase_contribution",
    "impact": {
      "monthlyAmount": 500
    }
  }'
```

**Resposta:**
```json
{
  "success": true,
  "data": {
    "originalProjection": {
      "finalValue": 750000,
      "totalReturn": 650000
    },
    "impactProjection": {
      "finalValue": 950000,
      "totalReturn": 850000
    },
    "improvement": {
      "absoluteValue": 200000,
      "percentage": 26.67,
      "description": "Melhoria de R$ 200.000 (26.67%)"
    }
  }
}
```

### Obter sugestões por categoria
```bash
curl -X GET http://localhost:3000/api/suggestions/client/cme4d06u30000f3x8btx7urtr/category/contribution \
  -H "Authorization: Bearer SEU_TOKEN_JWT"
```

### Análise de alinhamento das metas
```bash
curl -X GET http://localhost:3000/api/suggestions/client/cme4d06u30000f3x8btx7urtr/alignment \
  -H "Authorization: Bearer SEU_TOKEN_JWT"
```

## 👥 Gerenciamento de Clientes

### Listar clientes com paginação
```bash
curl -X GET "http://localhost:3000/api/clients?page=1&limit=10" \
  -H "Authorization: Bearer SEU_TOKEN_JWT"
```

### Buscar cliente específico
```bash
curl -X GET http://localhost:3000/api/clients/cme4d06u30000f3x8btx7urtr \
  -H "Authorization: Bearer SEU_TOKEN_JWT"
```

### Atualizar cliente (apenas advisors)
```bash
curl -X PUT http://localhost:3000/api/clients/cme4d06u30000f3x8btx7urtr \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN_JWT" \
  -d '{
    "name": "João Silva Santos",
    "age": 36,
    "perfilFamilia": "Casado com 2 filhos"
  }'
```

## 📊 Cenários de Uso Prático

### Cenário 1: Planejamento de Aposentadoria
```bash
# 1. Cliente com 30 anos quer se aposentar aos 60
# Valor inicial: R$ 20.000
# Aporte mensal: R$ 800
# Meta: R$ 1.500.000

curl -X POST http://localhost:3000/api/projections/simulate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN_JWT" \
  -d '{
    "initialValue": 20000,
    "events": [
      {
        "type": "Aporte Mensal",
        "value": 800,
        "frequency": "monthly"
      }
    ],
    "annualRate": 0.05,
    "endYear": 2054
  }'
```

### Cenário 2: Compra de Imóvel
```bash
# Cliente quer comprar imóvel em 5 anos
# Valor inicial: R$ 50.000
# Meta: R$ 200.000 (entrada)

curl -X POST http://localhost:3000/api/projections/simulate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN_JWT" \
  -d '{
    "initialValue": 50000,
    "events": [
      {
        "type": "Aporte Mensal",
        "value": 2000,
        "frequency": "monthly"
      }
    ],
    "annualRate": 0.04,
    "endYear": 2029
  }'
```

## 🔧 Utilitários

### Health Check
```bash
curl -X GET http://localhost:3000/health
```

### Estatísticas gerais do sistema
```bash
curl -X GET http://localhost:3000/api/suggestions/stats \
  -H "Authorization: Bearer SEU_TOKEN_JWT"
```

## 📝 Notas Importantes

1. **Autenticação**: Todos os endpoints (exceto `/health`, `/register` e `/login`) requerem token JWT
2. **Roles**: 
   - `advisor`: Acesso completo (leitura e escrita)
   - `viewer`: Apenas leitura
3. **Validação**: Todos os dados são validados com Zod
4. **Formato de Datas**: Use ISO 8601 (ex: "2024-12-31T00:00:00.000Z")
5. **Valores Monetários**: Sempre em formato numérico (ex: 1000.50)
6. **Taxa de Juros**: Em formato decimal (ex: 0.04 para 4% a.a.)

## 🚀 Próximos Passos

- Implementar importação de CSV via SSE (Dia 4)
- Adicionar histórico de simulações (Dia 5)
- Completar CRUD de goals, wallet e events
- Documentação Swagger automática
