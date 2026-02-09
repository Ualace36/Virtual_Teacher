// ============================================
// SNIPPETS DE ERROR HANDLING PARA n8n
// Copie e cole nos nodes Function
// ============================================

// ============================================
// 1. TRATADOR GENÉRICO DE ERRO COM RETRY
// ============================================
const maxRetries = 3;
const tentativaAtual = $json.tentativa || 1;
const operacao = "sua_operacao_aqui";

if ($json && ($json.error || $json.errno)) {
  const erro = $json.error || $json.message || "Erro desconhecido";
  
  console.error(`[${operacao}] Erro na tentativa ${tentativaAtual}: ${erro}`);
  
  if (tentativaAtual < maxRetries) {
    const delayMs = Math.pow(2, tentativaAtual - 1) * 1000; // 1s, 2s, 4s
    
    return {
      "json": {
        "status": "retry",
        "operacao": operacao,
        "tentativa": tentativaAtual + 1,
        "maxRetries": maxRetries,
        "delayMs": delayMs,
        "erroOriginal": erro,
        "timestamp": new Date().toISOString()
      }
    };
  } else {
    return {
      "json": {
        "status": "falha_final",
        "operacao": operacao,
        "message": `Falha em ${operacao} após ${maxRetries} tentativas`,
        "erroOriginal": erro,
        "errorCode": "MAX_RETRIES_EXCEEDED",
        "primeiroTentativaEm": $json.primeiro_tentativa_em || new Date().toISOString()
      }
    };
  }
}

// Sucesso
return {
  "json": {
    "status": "sucesso",
    "operacao": operacao,
    "tentativasUsadas": tentativaAtual,
    "timestamp": new Date().toISOString(),
    "resultado": $json
  }
};

// ============================================
// 2. VALIDADOR DE CAMPOS OBRIGATÓRIOS
// ============================================
const camposObrigatorios = ["userId", "messageType", "timestamp"];
const camposVazios = [];

camposObrigatorios.forEach(campo => {
  if (!$json[campo] || 
      (typeof $json[campo] === 'string' && $json[campo].trim().length === 0)) {
    camposVazios.push(campo);
  }
});

if (camposVazios.length > 0) {
  return {
    "json": {
      "status": "validacao_falhou",
      "errorCode": "VALIDATION_ERROR",
      "camposVazios": camposVazios,
      "severity": "high",
      "timestamp": new Date().toISOString(),
      "acao_necessaria": "Revisar entrada de dados"
    }
  };
}

return { "json": { "status": "validacao_ok", "dados": $json } };

// ============================================
// 3. LOGGING ESTRUTURADO COM CONTEXTO
// ============================================
const logEntry = {
  timestamp: new Date().toISOString(),
  userId: $('Log_Entrada')?.item?.json?.userId || "unknown",
  workflow: $node.name,
  nivel: "error", // info, warning, error, critical
  mensagem: $json.message || "Sem mensagem",
  codigo: $json.errorCode || "UNKNOWN",
  stack: $json.stack || null,
  context: {
    tentativa: $json.tentativa || 1,
    duracao_ms: $json.duracao_ms || null,
    entrada_tamanho: JSON.stringify($json).length
  }
};

console.log(JSON.stringify(logEntry, null, 2));

return {
  "json": {
    "logId": `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    "logEntry": logEntry,
    "salvar_em_bd": true
  }
};

// ============================================
// 4. CIRCUIT BREAKER (EVITAR CASCATA DE ERROS)
// ============================================
const estadoCircuitBreaker = {
  falhasConsecutivas: $json.falhasConsecutivas || 0,
  limiteAbrir: 5,
  estado: "fechado" // fechado, aberto, meio-aberto
};

if ($json && $json.error) {
  estadoCircuitBreaker.falhasConsecutivas++;
  
  if (estadoCircuitBreaker.falhasConsecutivas >= estadoCircuitBreaker.limiteAbrir) {
    estadoCircuitBreaker.estado = "aberto";
    
    console.warn("⚠️ CIRCUIT BREAKER ABERTO - Falhas recorrentes detectadas");
    
    return {
      "json": {
        "status": "circuit_breaker_aberto",
        "message": "Serviço temporariamente indisponível. Tente novamente em alguns minutos.",
        "errorCode": "SERVICE_UNAVAILABLE",
        "severity": "critical",
        "falhasConsecutivas": estadoCircuitBreaker.falhasConsecutivas,
        "retentarEm": "60s"
      }
    };
  }
} else {
  // Sucesso reseta o counter
  estadoCircuitBreaker.falhasConsecutivas = 0;
  estadoCircuitBreaker.estado = "fechado";
}

return { "json": { "status": "ok", "circuitBreaker": estadoCircuitBreaker } };

// ============================================
// 5. FALLBACK INTELIGENTE COM MÚLTIPLAS OPÇÕES
// ============================================
const estrategiasFallback = [
  {
    nome: "transcrição_groq",
    status: "falha",
    proxima: "transcrição_google"
  },
  {
    nome: "transcrição_google",
    status: "falha",
    proxima: "solicitar_texto"
  },
  {
    nome: "solicitar_texto",
    status: "ultima_opcao",
    proxima: null
  }
];

const estrategiaAtual = $json.estrategiaAtual || 0;
const fallback = estrategiasFallback[estrategiaAtual];

if (fallback.status === "falha") {
  return {
    "json": {
      "status": "alternativa_necessaria",
      "estrategiaFalhou": fallback.nome,
      "tentarProxima": fallback.proxima,
      "mensagemUsuario": `Falha em ${fallback.nome}. Tentando ${fallback.proxima}...`,
      "estrategiaIndex": estrategiaAtual + 1,
      "tentativa": $json.tentativa || 1
    }
  };
} else {
  return {
    "json": {
      "status": "sem_alternativas",
      "mensagemUsuario": "Desculpe, esgotamos as opções. Por favor, contate suporte.",
      "errorCode": "ALL_FALLBACKS_EXHAUSTED",
      "severity": "critical"
    }
  };
}

// ============================================
// 6. TIMEOUT E DEADLINE
// ============================================
const dataInicio = new Date($json.inicio || Date.now());
const timeoutMs = 30000; // 30 segundos
const tempoDecorrido = Date.now() - dataInicio.getTime();
const tempoRestante = timeoutMs - tempoDecorrido;

if (tempoRestante <= 0) {
  return {
    "json": {
      "status": "timeout",
      "errorCode": "OPERATION_TIMEOUT",
      "mensagemUsuario": "Operação demorou muito. Por favor, tente novamente.",
      "tempoDecorrido": tempoDecorrido,
      "timeoutLimite": timeoutMs,
      "severity": "high"
    }
  };
}

if (tempoRestante < 5000) {
  console.warn(`⏱️ AVISO: Apenas ${tempoRestante}ms restantes`);
}

return {
  "json": {
    "status": "dentro_prazo",
    "tempoRestante": tempoRestante,
    "porcentagemRestante": Math.round((tempoRestante / timeoutMs) * 100),
    "continuarProcessamento": true
  }
};

// ============================================
// 7. RASTREAMENTO DE DEPENDÊNCIAS
// ============================================
const dependencias = {
  supabase_bd: {
    status: $('Validar_Usuario_BD')?.json?.length >= 0 ? "ok" : "erro",
    erro: $('Validar_Usuario_BD')?.item?.json?.error?.message || null
  },
  groq_api: {
    status: $('Groq_Transcription')?.json?.text ? "ok" : "erro",
    erro: $('Groq_Transcription')?.item?.json?.error?.message || null
  },
  evolution_api: {
    status: $('Enviar_Fallback_Message')?.json?.messageId ? "ok" : "erro",
    erro: $('Enviar_Fallback_Message')?.item?.json?.error?.message || null
  }
};

const dependenciasComFalha = Object.entries(dependencias)
  .filter(([_, dep]) => dep.status === "erro")
  .map(([nome, dep]) => ({ servico: nome, erro: dep.erro }));

if (dependenciasComFalha.length > 0) {
  return {
    "json": {
      "status": "dependencias_indisponiveis",
      "falhas": dependenciasComFalha,
      "tentarAlternativa": true,
      "errorCode": "DEPENDENCY_FAILURE"
    }
  };
}

return { "json": { "status": "todas_dependencias_ok", "dependencias": dependencias } };

// ============================================
// 8. MÉTRICAS E PERFORMANCE
// ============================================
const metricas = {
  timestamp: new Date().toISOString(),
  userId: $('Log_Entrada')?.item?.json?.userId || "unknown",
  operacao: $node.name,
  duracao_ms: Date.now() - new Date($json.inicio).getTime(),
  tamanho_entrada_bytes: JSON.stringify($json).length,
  sucesso: !$json.error,
  tentativas: $json.tentativa || 1,
  memoria_uso_mb: process.memoryUsage().heapUsed / 1024 / 1024
};

// Alertar se performance ruim
if (metricas.duracao_ms > 5000) {
  metricas.aviso = "Operação lenta detectada";
}

console.log(`📊 MÉTRICA: ${metricas.operacao} - ${metricas.duracao_ms}ms`);

return { "json": metricas };

// ============================================
// 9. WRAPPER DE SEGURANÇA (SANITIZAÇÃO)
// ============================================
const sanitizarString = (str) => {
  if (typeof str !== 'string') return str;
  
  // Remove caracteres suspeitos
  return str
    .replace(/[<>'"]/g, '') // Remove tags HTML
    .substring(0, 1000)      // Limita tamanho
    .trim();
};

const dadosSanitizados = {
  userId: sanitizarString($json.userId),
  mensagem: sanitizarString($json.mensagem),
  timestamp: new Date($json.timestamp).getTime(), // Valida formato
};

// Valida tamanhos
if (JSON.stringify(dadosSanitizados).length > 50000) {
  return {
    "json": {
      "status": "input_muito_grande",
      "errorCode": "PAYLOAD_TOO_LARGE",
      "tamanho_bytes": JSON.stringify(dadosSanitizados).length,
      "limite_bytes": 50000
    }
  };
}

return { "json": { "status": "sanitizado", "dados": dadosSanitizados } };

// ============================================
// 10. MATRIZ DE DECISÃO (IF/ELSE COMPLEXO)
// ============================================
const classificarErro = (erro) => {
  const matrizDecisao = [
    {
      condicao: erro?.includes("timeout") || erro?.includes("504"),
      acao: { retryavel: true, delay: 5000, proximoServico: "fallback" }
    },
    {
      condicao: erro?.includes("authentication") || erro?.includes("401"),
      acao: { retryavel: false, severity: "critical", alerta: "credenciais" }
    },
    {
      condicao: erro?.includes("rate_limit") || erro?.includes("429"),
      acao: { retryavel: true, delay: 60000, proximoServico: "aguardar" }
    },
    {
      condicao: erro?.includes("validation"),
      acao: { retryavel: false, severity: "high", acao: "solicitar_correcao" }
    }
  ];

  const resultado = matrizDecisao.find(item => item.condicao);
  return resultado?.acao || { retryavel: true, delay: 2000, proximoServico: "fallback" };
};

const acaoRecomendada = classificarErro($json.error?.message);

return {
  "json": {
    "erro": $json.error?.message,
    "acaoRecomendada": acaoRecomendada,
    "timestamp": new Date().toISOString()
  }
};
