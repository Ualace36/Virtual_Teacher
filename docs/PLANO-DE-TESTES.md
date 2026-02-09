# Teste de Error Handling - Casos de Teste

## 🧪 Plano de Testes Completo

### Teste 1: Input Inválido
**Objetivo**: Validar que o workflow rejeita dados incompletos

**Setup**:
```bash
# Envie um webhook com userId vazio
curl -X POST http://localhost:5678/webhook-test/testando \
  -H "Content-Type: application/json" \
  -d '{
    "body": {
      "data": {
        "key": {
          "remoteJid": "@s.whatsapp.net",
          "fromMe": false,
          "id": "TEST123"
        },
        "messageType": "conversation",
        "message": { "conversation": "Olá" }
      },
      "instance": "session_01"
    }
  }'
```

**Resultado Esperado**:
- ✅ Erro "Dados de entrada inválidos"
- ✅ Log em error_logs com severity="high"
- ✅ Admin recebe alerta
- ❌ Não chama AI Agent

**Verificar**:
```sql
SELECT * FROM error_logs 
WHERE error_code = 'VALIDATION_ERROR' 
ORDER BY created_at DESC LIMIT 1;
```

---

### Teste 2: Falha na Busca de Usuário (BD)
**Objetivo**: Testar retry logic quando BD está lento

**Setup**:
1. Simule falha de BD desconectando (ou acionando throttling)
2. Envie mensagem normal

**Esperado**:
- ✅ Tentativa 1: Falha
- ✅ Aguarda 1s
- ✅ Tentativa 2: Falha
- ✅ Aguarda 2s
- ✅ Tentativa 3: Sucesso OU Fallback final
- ✅ Log com `tentativa=3`

**SQL para verificar**:
```sql
SELECT 
  error_code, 
  COUNT(*) as tentativas,
  MIN(created_at) as primeira,
  MAX(created_at) as ultima
FROM error_logs
WHERE userId = '5573xxx' 
  AND error_code = 'DB_CONNECTION_ERROR'
  AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY error_code;
```

---

### Teste 3: Áudio Corrompido
**Objetivo**: Testar fallback quando áudio não pode ser obtido

**Setup**:
```bash
# Envie mensagem com ID de áudio fake
curl -X POST http://localhost:5678/webhook-test/testando \
  -H "Content-Type: application/json" \
  -d '{
    "body": {
      "data": {
        "key": {
          "remoteJid": "557388737835@s.whatsapp.net",
          "fromMe": false,
          "id": "INVALID_AUDIO_ID"
        },
        "messageType": "audioMessage",
        "message": { "base64": "" }
      },
      "instance": "session_01"
    }
  }'
```

**Esperado**:
- ✅ Erro ao obter áudio
- ✅ Fallback: Enviar mensagem "Envie texto"
- ✅ Não tenta transcrever
- ✅ Log com `errorCode=AUDIO_RETRIEVAL_FAILED`

---

### Teste 4: Transcrição Vazia
**Objetivo**: Groq retorna texto vazio

**Setup**:
1. Envie áudio com ruído branco/silêncio
2. Groq não consegue transcrever → `text=""` ou `text=null`

**Esperado**:
- ✅ Detecta transcrição vazia
- ✅ Fallback: "Não consegui entender o áudio"
- ✅ Não chama AI Agent
- ✅ Log com `errorCode=EMPTY_TRANSCRIPTION`

---

### Teste 5: Falha de Transcrição com Retry
**Objetivo**: Testar retry da API Groq

**Setup**:
1. Simule falha de Groq (falhar primeiras 2 vezes)
2. Envie áudio válido

**Esperado**:
```
Tentativa 1: Falha com erro 429/500
  ↓ Aguarda 1s
Tentativa 2: Falha com erro 429/500
  ↓ Aguarda 2s
Tentativa 3: Sucesso (retorna transcrição)
```

**Log esperado**:
```sql
SELECT * FROM error_logs 
WHERE error_code = 'TRANSCRIPTION_FAILED' 
AND userId LIKE '%5573%' 
AND tentativa IN (1, 2)
ORDER BY created_at;
```

---

### Teste 6: Falha Total (Max Retries Exceeded)
**Objetivo**: Quando todos os 3 retries falham

**Setup**:
1. Desabilite Groq API (ou simule falha permanente)
2. Envie áudio

**Esperado**:
- ✅ 3 tentativas
- ✅ Fallback final: "Falha após 3 tentativas"
- ✅ Log com `errorCode=MAX_RETRIES_EXCEEDED`
- ✅ Severity="HIGH" ou "CRITICAL"
- ✅ Admin recebe alerta

**Verificar**:
```sql
SELECT 
  COUNT(*) as tentativas,
  ARRAY_AGG(error_code) as erros,
  ARRAY_AGG(created_at) as timestamps
FROM error_logs
WHERE userId LIKE '%5573%'
AND workflow_step LIKE '%Transcription%'
AND created_at > NOW() - INTERVAL '5 minutes'
GROUP BY userId;
```

---

### Teste 7: Falha no Envio de Mensagem
**Objetivo**: Evolution API não consegue enviar

**Setup**:
1. Invalide credenciais de Evolution temporariamente
2. Envie mensagem que chegue até "Enviar Fallback"

**Esperado**:
- ✅ Erro ao enviar
- ✅ Log com `errorCode=SEND_MESSAGE_FAILED`
- ✅ Severity="HIGH"
- ✅ Retryable=true (para tenta novamente)

---

### Teste 8: Cascata de Erros (Circuit Breaker)
**Objetivo**: Múltiplas falhas consecutivas

**Setup**:
1. Falhe Groq 5 vezes seguidas em 2 minutos
2. Na 6ª tentativa, verificar se Circuit Breaker abre

**Esperado**:
- ✅ Falhas 1-5: Tenta processar normalmente
- ✅ Falha 6: Recebe "Circuit Breaker ABERTO"
- ✅ Mensagem: "Serviço indisponível. Tente em 1 minuto"
- ✅ Log com `severity=CRITICAL`

---

### Teste 9: Performance (Timeout)
**Objetivo**: Operação demorada demais (>30s)

**Setup**:
1. Simule Groq lento (responde em 35s)
2. Envie mensagem

**Esperado**:
- ✅ Timeout após 30s
- ✅ Erro: "Operação demorou muito"
- ✅ Fallback acionado
- ✅ Log com `errorCode=OPERATION_TIMEOUT`

---

### Teste 10: Usuário Não Registrado
**Objetivo**: Testar fluxo de novos usuários

**Setup**:
```bash
# Envie de número não cadastrado
curl -X POST http://localhost:5678/webhook-test/testando \
  -H "Content-Type: application/json" \
  -d '{
    "body": {
      "data": {
        "key": {
          "remoteJid": "559999999999@s.whatsapp.net",
          "fromMe": false,
          "id": "NEW_USER"
        },
        "pushName": "Novo Usuário",
        "messageType": "conversation",
        "message": { "conversation": "Olá, quero aprender inglês!" }
      },
      "instance": "session_01"
    }
  }'
```

**Esperado**:
- ✅ Verifica BD: usuário NÃO encontrado
- ✅ Envia: "Você ainda não é nosso aluno..."
- ✅ Cria novo registro em usuarios
- ✅ NÃO chama AI Agent
- ✅ Log com userId do novo usuário

---

## 📊 Dashboard de Testes

### Query para Status Geral:
```sql
SELECT 
  DATE(created_at) as data,
  COUNT(*) as total_erros,
  COUNT(DISTINCT userId) as usuarios_afetados,
  COUNT(CASE WHEN retryable = true THEN 1 END) as retentaveis,
  COUNT(CASE WHEN severity = 'critical' THEN 1 END) as criticos,
  ROUND(100.0 * COUNT(CASE WHEN retryable = true THEN 1 END) / 
    NULLIF(COUNT(*), 0), 2) as percentual_retentavel
FROM error_logs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY data DESC;
```

### Erros Mais Frequentes:
```sql
SELECT 
  error_code,
  COUNT(*) as frequencia,
  ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM error_logs), 2) as percentual,
  AVG(CAST(retryable AS INT)) as taxa_retry,
  COUNT(DISTINCT severity) as severidades
FROM error_logs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY error_code
ORDER BY frequencia DESC
LIMIT 10;
```

### Usuários com Mais Erros:
```sql
SELECT 
  userId,
  COUNT(*) as erros,
  COUNT(DISTINCT error_code) as tipos_diferentes,
  STRING_AGG(DISTINCT severity, ', ') as severidades_observadas,
  MAX(created_at) as ultimo_erro
FROM error_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY userId
HAVING COUNT(*) >= 2
ORDER BY erros DESC;
```

---

## ✅ Checklist Final

- [ ] Teste 1: Input inválido ✓
- [ ] Teste 2: Retry na BD ✓
- [ ] Teste 3: Áudio corrompido ✓
- [ ] Teste 4: Transcrição vazia ✓
- [ ] Teste 5: Retry Groq ✓
- [ ] Teste 6: Max retries exceeded ✓
- [ ] Teste 7: Falha no envio ✓
- [ ] Teste 8: Circuit breaker ✓
- [ ] Teste 9: Timeout ✓
- [ ] Teste 10: Novo usuário ✓
- [ ] Verificar logs no Supabase ✓
- [ ] Alertas chegam ao admin ✓
- [ ] Performance dentro do esperado ✓
- [ ] Nenhum erro crítico não logado ✓

---

## 🚀 Ambiente de Teste

### Docker Compose para testes locais:
```yaml
version: '3.8'
services:
  n8n:
    image: n8nio/n8n:latest
    ports:
      - "5678:5678"
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=admin
      - N8N_BASIC_AUTH_PASSWORD=test123
  
  supabase:
    image: supabase/postgres:latest
    environment:
      POSTGRES_PASSWORD: test
    ports:
      - "5432:5432"

  mock-groq:
    image: mockserver/mockserver:latest
    ports:
      - "1080:1080"
```
