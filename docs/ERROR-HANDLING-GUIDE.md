# Error Handling Robusto - Guia de Implementação

## 📋 Padrões Implementados

### 1. **Logging Estruturado**
```
Log_Entrada: Captura dados iniciais
- timestamp: Quando a mensagem chegou
- userId: Quem enviou
- messageType: Tipo (texto/áudio/imagem)
- eventStatus: Estado do processamento
```

**Benefit**: Rastreabilidade completa de cada requisição

---

### 2. **Validação de Input**
```
Validar_Input: Se node que verifica dados essenciais
- Garante que userId não vazio
- Evita processamento desnecessário
- Retorna erro imediato se inválido
```

**Best Practice**: Falhe rápido, economize recursos

---

### 3. **Try/Catch com Fallback**
```javascript
// Padrão em cada operação crítica
if ($json && $json.error) {
  // Retornar fallback amigável ao usuário
  return {
    "json": {
      "status": "fallback",
      "mensagem": "Desculpe, não consegui processar..."
    }
  };
}
```

**Aplicado em**:
- ✅ Obter_Audio_Com_Retry
- ✅ Groq_Transcription
- ✅ Enviar_Fallback_Message

---

### 4. **Retry com Backoff Exponencial**
```javascript
const maxRetries = 3;
const retryDelays = [1000, 2000, 5000]; // 1s, 2s, 5s

if (tentativaAtual < maxRetries) {
  return {
    "json": {
      "status": "retry",
      "tentativa": tentativaAtual + 1,
      "delay": 2000 * tentativaAtual // Aumenta delay
    }
  };
}
```

**Estratégia**: 
- 1ª falha → Aguarda 1s → Tenta novamente
- 2ª falha → Aguarda 2s → Tenta novamente
- 3ª falha → Aguarda 5s → Tenta novamente
- Falha final → Chama fallback

---

### 5. **Logging de Erros em Banco de Dados**
```
Log_Erro_no_BD: Tabela 'error_logs'
- userId, error_message, error_code
- severity (low/medium/high/critical)
- retryable: Se pode ser retentado
- workflow_step: Onde falhou
```

**Análise**: Identifique padrões de erro

---

### 6. **Alertas ao Admin**
```
Alertar_Admin: Notifica administrador em tempo real
```

**Configurar em `.env`**:
```
ADMIN_INSTANCE=seu_instancia
ADMIN_PHONE=5511999999999
```

---

## 🔧 Como Integrar com Seu Workflow Actual

### Passo 1: Adicionar Variables Globais
Acesse **Workflow Settings** → **Variables**:

```
GROQ_API_KEY: sua_chave_groq
ADMIN_INSTANCE: instance_name
ADMIN_PHONE: 5511999999999
```

### Passo 2: Criar Tabela no Supabase
```sql
CREATE TABLE error_logs (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  userId TEXT NOT NULL,
  error_message TEXT,
  error_code TEXT,
  severity TEXT,
  timestamp TIMESTAMP,
  workflow_step TEXT,
  retryable BOOLEAN,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_userId ON error_logs(userId);
CREATE INDEX idx_timestamp ON error_logs(timestamp DESC);
```

### Passo 3: Substituir Nós Críticos
No seu workflow atual:

**Antes (sem tratamento)**:
```
HTTP Request → Transcription Message → Set IA Agent
```

**Depois (com tratamento)**:
```
HTTP Request 
  ↓
Tratador_Erro_Transcricao
  ├→ (sucesso) → IA Agent
  └→ (erro) → Enviar_Fallback_Message
  
Ambos → Log_Erro_no_BD → Alertar_Admin
```

---

## ⚠️ Códigos de Erro Padronizados

| Código | Significado | Retryable | Severidade |
|--------|-----------|-----------|-----------|
| `VALIDATION_ERROR` | Dados inválidos | ❌ Não | High |
| `DB_CONNECTION_ERROR` | Falha BD | ✅ Sim | High |
| `AUDIO_RETRIEVAL_FAILED` | Não obteve áudio | ✅ Sim | Medium |
| `TRANSCRIPTION_FAILED` | Groq falhou | ✅ Sim | Medium |
| `EMPTY_TRANSCRIPTION` | Áudio vazio | ❌ Não | Low |
| `SEND_MESSAGE_FAILED` | Envio falhou | ✅ Sim | High |
| `MAX_RETRIES_EXCEEDED` | Limite tentativas | ❌ Não | Critical |

---

## 📊 Monitoramento

### Query para análise de erros:
```sql
SELECT 
  error_code,
  COUNT(*) as total,
  ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM error_logs), 2) as percentage,
  ARRAY_AGG(DISTINCT severity) as severidades
FROM error_logs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY error_code
ORDER BY total DESC;
```

### Erros por usuário:
```sql
SELECT 
  userId,
  COUNT(*) as erros_total,
  COUNT(DISTINCT error_code) as tipos_diferentes,
  STRING_AGG(DISTINCT error_code, ', ') as erros
FROM error_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY userId
HAVING COUNT(*) > 0
ORDER BY erros_total DESC;
```

---

## 🎯 Próximas Melhorias

1. **Circuit Breaker**: Desabilitar Groq se taxa de falha > 50%
2. **Fallback automático**: Se Groq falha, usar Google Speech-to-Text
3. **Cache**: Armazenar transcrições bem-sucedidas
4. **Métricas**: Dashboard com taxa de sucesso por hora
5. **SLA Alertas**: Notificar se tempo médio > 5 segundos

---

## 📝 Checklist de Implementação

- [ ] Criar tabela `error_logs` no Supabase
- [ ] Adicionar variables globais
- [ ] Integrar nós de tratamento de erro
- [ ] Testar com mensagens inválidas
- [ ] Testar com áudio corrompido
- [ ] Configurar alertas do admin
- [ ] Criar dashboard de monitoramento
- [ ] Documentar códigos de erro da sua equipe
