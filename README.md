# Virtual_Teacher

Version: En

# AI Agent for English Teaching (Virtual Teacher)

This project implements an AI agent that acts as a virtual English teacher via WhatsApp. The agent is designed to interact with students in a friendly and encouraging manner, helping them practice speaking, fluency, and listening comprehension.

## 🌟 Features

- **Virtual English Teacher**: An AI agent with the persona of an experienced, gentle, and playful English teacher.
- **Conversational Interaction**: Encourages oral practice with open-ended questions about daily life and topics of the student's interest.
- **Correction and Feedback**: Corrects errors gently, explaining how the student can improve.
- **Personalized Suggestions**: Suggests useful expressions, natural phrases, slang, phrasal verbs, and practical structures.
- **Adaptation to Student's Level**: Adjusts the level of activities and vocabulary according to the student's progress.
- **Weekly Performance Report**: Generates a detailed report every 7 days, evaluating fluency, pronunciation, vocabulary, and grammatical structure.
- **Audio Processing**: Transcribes audio messages to text and then generates audio responses for the student.
- **Fragmented Audio Sending**: The `EmitirParteAudio` sub-workflow ensures that long audio responses are split and sent in parts to avoid communication failures.

## 🛠️ Technologies Used

The project is built on a robust and scalable architecture, using the following technologies:

- **Docker**: For container orchestration and management of each service.
- **n8n**: A workflow automation platform that connects all APIs and services.
- **Evolution API**: Integration with the WhatsApp API for sending and receiving text and audio messages.
- **PostgreSQL**: Database for data persistence.
- **Redis**: Used as chat memory for the AI agent, ensuring conversation continuity.
- **Google Gemini**: The Language Model (LLM) that powers the "brain" of the AI agent.
- **RabbitMQ**: A message queue manager for communication between services.
- **Groq API**: Used for efficient audio transcription via the `whisper-large-v3` model.
- **Google TTS**: (Translated as VoiceRSS in the workflow) to generate audio from the agent's text responses.

## 🧩 Workflow (n8n)

The main workflow (`Agente_IA.json`) orchestrates all the agent's logic:

1.  **`Webhook_Evolution`**: Receives a new WhatsApp message via the Evolution API.
2.  **`Dados_Evolution`**: Extracts essential data from the message (sender, instance, type, content, etc.).
3.  **`fromMe`**: Checks if the message was sent by the agent itself, ignoring it if so.
4.  **`TIPO MENSAGEM`**: A `Switch` node that directs the flow based on the message type (text or audio).
    -   **Text Path**: `MensagemTexto` -> `Mensagem` -> `Validação_Type_Message` -> `Preparar_Input_para_Redis1`
    -   **Audio Path**: `Obter mídia em base64` -> `Convert to File` -> `HTTP Request` (Groq/Whisper) -> `Transcription Message` -> `Verificar Transcrição Recebida` -> `Mensagem` -> `Validação_Type_Message` -> `Preparar_Input_para_Redis1`
5.  **`Redis Chat Memory`**: Manages the conversation history with the student.
6.  **`AI Agent`**: The central node that uses the Google Gemini LLM to process the student's message and generate a response.
7.  **`Wait`**: A strategic pause.
8.  **`Marcar mensagens como lidas`**: Ensures the agent marks the student's message as read.
9.  **`dividir`**: Splits the agent's response into smaller parts to avoid size limits and ensure successful audio generation.
10. **`Gerar Áudio (VoiceRSS)`**: Converts each part of the text response into an audio file.
11. **`Call EmitirParteAudio`**: Initiates the sub-workflow to send the audio parts to the student.

The sub-workflow (`subWorkflow_enviarPartesAudio.json`) is called by the main workflow to handle audio sending:

1.  **`Start`**: Receives the call information from the main workflow.
2.  **`Loop Over Items`**: Iterates over each generated audio part.
3.  **`Extract from File`**: Extracts the binary from the audio file.
4.  **`Enviar Áudio - Parte`**: Sends the audio file to the student via the Evolution API.
5.  **`Wait`**: Adds a small delay between sending each audio part, ensuring there is no congestion and all parts are received correctly.

---
Made with ❤️


Version: Português PT-Br

# Agente de IA para Ensino de Inglês (Professor Virtual)

Este projeto implementa um agente de IA que atua como um professor virtual de inglês via WhatsApp. O agente é projetado para interagir com os alunos de forma amigável e encorajadora, ajudando-os a praticar a fala, a fluência e a compreensão auditiva.

## 🌟 Funcionalidades

- **Professor Virtual de Inglês**: Um agente de IA com a persona de um professor de inglês experiente, gentil e lúdico.
- **Interação Conversacional**: Estimula a prática oral com perguntas abertas sobre tópicos cotidianos e de interesse do aluno.
- **Correção e Feedback**: Corrige erros de forma suave, explicando como o aluno pode melhorar.
- **Sugestões Personalizadas**: Sugere expressões úteis, frases naturais, gírias e estruturas práticas.
- **Adaptação ao Nível do Aluno**: Ajusta o nível das atividades e do vocabulário conforme a evolução do estudante.
- **Relatório de Desempenho Semanal**: Gera um relatório detalhado a cada 7 dias, avaliando fluência, pronúncia, vocabulário e estrutura gramatical.
- **Processamento de Áudio**: Transcreve mensagens de áudio para texto e, em seguida, gera respostas em áudio para o aluno.
- **Envio de Áudio Fracionado**: O sub-fluxo `EmitirParteAudio` garante que respostas de áudio longas sejam divididas e enviadas em partes para evitar falhas de comunicação.

## 🛠️ Tecnologias Utilizadas

O projeto é construído sobre uma arquitetura robusta e escalável, utilizando as seguintes tecnologias:

- **Docker**: Para orquestração e gerenciamento dos contêineres de cada serviço.
- **n8n**: Plataforma de automação de fluxo de trabalho que conecta todas as APIs e serviços.
- **Evolution API**: Integração com a API do WhatsApp para envio e recebimento de mensagens de texto e áudio.
- **PostgreSQL**: Banco de dados para persistência de dados.
- **Redis**: Utilizado como memória de chat para o agente de IA, garantindo a continuidade da conversa.
- **Google Gemini**: Modelo de linguagem (LLM) que alimenta o "cérebro" do agente de IA.
- **RabbitMQ**: Gerenciador de filas de mensagens para comunicação entre os serviços.
- **Groq API**: Usado para a transcrição eficiente de áudios via modelo `whisper-large-v3`.
- **Google TTS**: (Traduzido como VoiceRSS no fluxo) para gerar áudio a partir do texto das respostas do agente.

## 🧩 Fluxo de Trabalho (n8n)

O fluxo principal (`Agente_IA.json`) orquestra toda a lógica do agente:

1.  **`Webhook_Evolution`**: Recebe uma nova mensagem do WhatsApp via Evolution API.
2.  **`Dados_Evolution`**: Extrai os dados essenciais da mensagem (remetente, instância, tipo, conteúdo, etc.).
3.  **`fromMe`**: Verifica se a mensagem foi enviada pelo próprio agente, ignorando-a se for o caso.
4.  **`TIPO MENSAGEM`**: Um nó `Switch` que direciona o fluxo com base no tipo da mensagem (texto ou áudio).
    -   **Caminho de Texto**: `MensagemTexto` -> `Mensagem` -> `Validação_Type_Message` -> `Preparar_Input_para_Redis1`
    -   **Caminho de Áudio**: `Obter mídia em base64` -> `Convert to File` -> `HTTP Request` (Groq/Whisper) -> `Transcription Message` -> `Verificar Transcrição Recebida` -> `Mensagem` -> `Validação_Type_Message` -> `Preparar_Input_para_Redis1`
5.  **`Redis Chat Memory`**: Gerencia o histórico da conversa com o aluno.
6.  **`AI Agent`**: O nó central que utiliza o LLM do Google Gemini para processar a mensagem do aluno e gerar a resposta.
7.  **`Wait`**: Uma pausa estratégica.
8.  **`Marcar mensagens como lidas`**: Garante que o agente marque a mensagem do aluno como lida.
9.  **`dividir`**: Divide a resposta do agente em partes menores para evitar limites de tamanho e garantir que a geração de áudio seja bem-sucedida.
10. **`Gerar Áudio (VoiceRSS)`**: Converte cada parte da resposta textual em um arquivo de áudio.
11. **`Call EmitirParteAudio`**: Inicia o sub-fluxo para enviar as partes do áudio ao aluno.

O sub-fluxo (`subWorkflow_enviarPartesAudio.json`) é chamado pelo fluxo principal para lidar com o envio de áudio:

1.  **`Start`**: Recebe as informações da chamada do fluxo principal.
2.  **`Loop Over Items`**: Itera sobre cada parte do áudio gerado.
3.  **`Extract from File`**: Extrai o binário do arquivo de áudio.
4.  **`Enviar Áudio - Parte`**: Envia o arquivo de áudio para o aluno via Evolution API.
5.  **`Wait`**: Adiciona um pequeno atraso entre o envio de cada parte do áudio, garantindo que não haja congestionamento e que todas as partes sejam recebidas corretamente.

## 🚀 Como Executar

Para configurar e rodar este projeto, siga os seguintes passos:

1.  **Configurar as Credenciais**:
    -   Evolution API
    -   Redis
    -   Google Gemini API
    -   Groq API
2.  **Importar os Fluxos**:
    -   Importe os arquivos `Agente_IA.json` e `subWorkflow_enviarPartesAudio.json` para sua instância do n8n.
3.  **Configurar o Docker**:
    -   Certifique-se de ter o Docker, Docker Compose, PostgreSQL, Redis e RabbitMQ configurados e rodando.
4.  **Ativar os Workflows**:
    -   Ative ambos os workflows no n8n.

---
Vamos para cima!!!