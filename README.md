# InterLibras

Aplicação web para reconhecimento de 21 letras estáticas do alfabeto de Libras. A câmera, a detecção da mão e a classificação são executadas diretamente no navegador: nenhuma imagem é enviada para um backend.

## Como funciona

1. O MediaPipe Hand Landmarker localiza 21 pontos da mão.
2. Os pontos são normalizados para os mesmos 63 valores usados no treinamento.
3. O Random Forest treinado percorre 240 árvores no navegador.
4. O resultado é estabilizado por duas leituras consecutivas e exibido com a confiança.

O modelo atual reconhece:

`A, B, C, D, E, F, G, I, L, M, N, O, P, Q, R, S, T, U, V, W, Y`

As letras `H`, `J`, `K`, `X` e `Z` dependem de movimento e exigirão um modelo temporal.

## Tecnologias

- React 18 e TypeScript
- Vite
- MediaPipe Tasks Vision para WebAssembly
- Random Forest exportado para um formato binário compacto
- Vercel para hospedagem estática

Não há função serverless, API ou banco de dados no funcionamento da aplicação publicada.

## Desenvolvimento

Requisitos:

- Node.js 20 ou mais recente
- pnpm

```bash
pnpm install
pnpm dev
```

Abra `http://localhost:5173`. A câmera exige `localhost` ou HTTPS.

## Build

```bash
pnpm build
```

O resultado estático será criado em `dist/`.

## Modelos locais

- `public/models/hand_landmarker.task`: modelo oficial do MediaPipe para localizar a mão.
- `public/models/libras_21_forest.bin`: Random Forest usado pelo navegador.
- `api/models/libras_21_model.joblib`: modelo original do scikit-learn, mantido como fonte e referência.

Os arquivos WebAssembly necessários ficam em `public/mediapipe/`, sem dependência de CDN em tempo de execução.

## Exportar novamente o modelo web

Com o ambiente Python original configurado:

```bash
python scripts/export_web_model.py
python scripts/verify_web_model.py
```

O verificador compara previsões e probabilidades do arquivo web com o modelo do scikit-learn usando amostras dos conjuntos de treinamento e validação.

## Treinamento

O modelo original é um `RandomForestClassifier` com:

- 240 árvores;
- 63 características por amostra;
- 21 classes;
- 53.760 amostras da base original;
- reforço e validação com uma base pública externa.

O script `scripts/train_model.py` reproduz o treinamento quando os datasets locais estão disponíveis. Treinar não é necessário para executar ou publicar a aplicação.

## Privacidade

Os quadros da câmera são processados em memória no dispositivo. O site publicado não envia fotografias, landmarks ou previsões para um servidor.

## Limitações atuais

- resultados variam com iluminação, enquadramento e câmera;
- apenas uma mão é analisada;
- sinais com movimento ainda não são reconhecidos;
- a primeira abertura baixa os modelos locais do site e pode levar alguns segundos.
