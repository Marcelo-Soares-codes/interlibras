# InterLibras

Aplicação web mobile-first que usa visão computacional para reconhecer letras estáticas do alfabeto de Libras pela câmera do dispositivo.

O usuário abre o site, toca em **Iniciar reconhecimento**, permite o acesso à câmera e posiciona uma mão na área indicada. A aplicação envia pequenos quadros da câmera para uma API Python, identifica a letra e exibe o resultado com o nível de confiança.

> **O modelo de inteligência artificial já está treinado e incluído neste repositório.** Para usar o projeto, não é necessário baixar datasets, treinar uma IA ou executar o script de treinamento.

---

## O que o projeto faz

- Abre a câmera diretamente no navegador.
- Analisa os sinais continuamente, com intervalo controlado para evitar consumo excessivo.
- Reconhece 21 letras estáticas de Libras.
- Mostra a letra reconhecida e a confiança da previsão.
- Funciona em computadores e possui interface otimizada para celulares.
- Oferece envio de foto como alternativa quando a câmera não está disponível.
- Processa as imagens em memória; a aplicação não salva as fotos enviadas.

## Letras reconhecidas

O modelo reconhece estas 21 letras:

```text
A  B  C  D  E  F  G  I  L  M  N  O  P  Q  R  S  T  U  V  W  Y
```

Estas cinco letras ainda não são reconhecidas:

```text
H  J  K  X  Z
```

### Por que H, J, K, X e Z ficaram de fora?

Esses sinais dependem de movimento. O modelo atual classifica a posição da mão em um quadro individual, portanto não acompanha a trajetória do gesto ao longo do tempo. Para incluir essas letras corretamente, será necessário um modelo temporal treinado com sequências de vídeo.

---

## Tecnologias utilizadas

### Interface

- React 18
- TypeScript
- Vite
- Lucide React para ícones
- API `getUserMedia` do navegador para acesso à câmera

### API e inteligência artificial

- Python
- Flask
- OpenCV
- MediaPipe e CVZone para localizar a mão
- Scikit-learn
- Random Forest para classificar as letras
- Joblib para carregar o modelo treinado

## Como o reconhecimento funciona

1. O navegador captura um quadro reduzido da câmera.
2. O quadro é enviado para `POST /predict`.
3. MediaPipe/CVZone localiza 21 pontos de referência da mão.
4. As coordenadas desses pontos são normalizadas.
5. O modelo Random Forest compara o padrão com as letras aprendidas.
6. A API devolve a letra e a confiança da previsão.
7. A interface aguarda resultados consecutivos compatíveis antes de fixar a letra na tela.

O envio ao servidor é sequencial e possui intervalo entre análises. Uma nova requisição só é programada depois que a anterior termina, reduzindo o risco de acumular requisições, criar loops descontrolados ou consumir memória excessiva.

---

# Como executar no Windows — passo a passo completo

Siga os passos exatamente na ordem. Você precisará deixar **dois terminais abertos ao mesmo tempo**: um para a IA/API e outro para o site.

## 1. Instale os programas necessários

Instale:

1. **Python 3.11**: https://www.python.org/downloads/release/python-3119/
2. **Node.js LTS**: https://nodejs.org/
3. **Git**: https://git-scm.com/download/win

Durante a instalação do Python, marque a opção:

```text
Add Python to PATH
```

Depois de instalar tudo, reinicie o computador. Isso evita que o terminal continue usando as configurações antigas.

## 2. Baixe o projeto

### Opção A — usando Git

Abra a página do repositório, copie o endereço fornecido pelo botão **Code** e execute:

```powershell
git clone ENDERECO_DO_REPOSITORIO
cd interlibras
```

Substitua `ENDERECO_DO_REPOSITORIO` pelo endereço real do repositório.

### Opção B — baixando um ZIP

1. Na página do repositório, clique em **Code**.
2. Clique em **Download ZIP**.
3. Extraia o arquivo ZIP.
4. Abra a pasta extraída.
5. Clique com o botão direito em uma área vazia da pasta.
6. Escolha **Abrir no Terminal**.

Todos os próximos comandos devem ser executados dentro da pasta do projeto, onde estão `README.md`, `package.json` e a pasta `api`.

## 3. Confirme que Python e Node.js estão instalados

No terminal, execute um comando por vez:

```powershell
py --version
node --version
npm --version
```

Você deve ver números de versão. Para o Python, prefira `Python 3.11.x`.

Se aparecer “comando não reconhecido”, feche o terminal, abra novamente e tente outra vez. Se continuar falhando, reinstale o programa correspondente.

## 4. Prepare a API Python

No primeiro terminal, ainda dentro da pasta do projeto, crie o ambiente isolado do Python:

```powershell
py -3.11 -m venv .venv
```

Ative o ambiente:

```powershell
.\.venv\Scripts\Activate.ps1
```

Se o PowerShell bloquear a ativação, execute isto uma vez:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

Digite `S` para confirmar, feche o terminal, abra-o novamente na pasta do projeto e repita:

```powershell
.\.venv\Scripts\Activate.ps1
```

Quando funcionar, o começo da linha do terminal mostrará algo parecido com:

```text
(.venv) PS C:\...\interlibras>
```

Instale as dependências da API:

```powershell
python -m pip install --upgrade pip
pip install -r api\requirements.txt
```

Essa instalação pode demorar alguns minutos.

## 5. Inicie a IA/API

No mesmo terminal em que aparece `(.venv)`, execute:

```powershell
python api\app.py
```

Não feche esse terminal. A API estará disponível em:

```text
http://localhost:8000
```

Para verificar se o modelo foi carregado, abra no navegador:

http://localhost:8000/health

Se estiver funcionando, será exibida uma resposta em formato JSON informando o estado do serviço e do modelo.

## 6. Inicie o site

Abra **um segundo terminal** na mesma pasta do projeto. Não feche o terminal da API.

No segundo terminal, instale as dependências da interface:

```powershell
npm install
```

Depois, inicie o site:

```powershell
npm run dev
```

O terminal mostrará um endereço semelhante a:

```text
http://localhost:5173
```

Abra esse endereço no Chrome, Edge ou outro navegador moderno.

## 7. Use o reconhecimento

1. Clique em **Iniciar reconhecimento**.
2. Quando o navegador perguntar, clique em **Permitir câmera**.
3. Posicione somente uma mão dentro da área indicada.
4. Faça uma das 21 letras suportadas.
5. Mantenha o gesto por alguns instantes.
6. Veja a letra reconhecida e a confiança na parte inferior da tela.

## 8. Como encerrar

Nos dois terminais, pressione:

```text
Ctrl + C
```

Isso encerra o site e a API.

Na próxima vez, não é necessário instalar tudo novamente. Use apenas:

### Primeiro terminal

```powershell
cd CAMINHO_DA_PASTA_INTERLIBRAS
.\.venv\Scripts\Activate.ps1
python api\app.py
```

### Segundo terminal

```powershell
cd CAMINHO_DA_PASTA_INTERLIBRAS
npm run dev
```

---

## Execução no Linux ou macOS

Tenha Python 3.11, Node.js LTS e Git instalados. Dentro da pasta do projeto:

### Terminal 1 — API

```bash
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r api/requirements.txt
python api/app.py
```

### Terminal 2 — interface

```bash
npm install
npm run dev
```

Abra `http://localhost:5173` no navegador.

---

## O modelo já treinado

O arquivo principal utilizado pela API está incluído em:

```text
api/models/libras_21_model.joblib
```

Ele possui aproximadamente 9,5 MB e é carregado automaticamente quando `python api/app.py` é executado. A variável padrão do projeto é:

```text
LIBRAS_MODEL=libras_21
```

Portanto:

- não execute o treinamento para usar o aplicativo;
- não baixe datasets para executar o aplicativo;
- não mova nem renomeie o arquivo do modelo;
- confirme que o arquivo existe caso a API informe que não encontrou o modelo.

## Treinamento — apenas para quem quiser estudar

O modelo Random Forest foi treinado com 53.760 amostras de landmarks do projeto educacional [LIBRAS-Recognition](https://github.com/victor-nasc/LIBRAS-Recognition) e validado também com landmarks extraídos de uma base pública externa.

Nos conjuntos de teste utilizados durante o desenvolvimento, o modelo alcançou:

- 99,93% de acurácia no teste interno;
- 99,06% de acurácia em 954 imagens externas reservadas.

Esses valores descrevem apenas os conjuntos testados. Eles não significam que qualquer imagem possível será reconhecida com 100% de precisão. Iluminação, enquadramento, formato da mão, distância e fundo podem afetar o resultado.

O script `scripts/train_model.py` existe para estudo e reprodução do treinamento, mas depende dos datasets de origem. Ele **não faz parte dos passos necessários para rodar o projeto**.

---

## Como conseguir resultados melhores

- Use um ambiente bem iluminado.
- Mostre apenas uma mão.
- Deixe todos os dedos visíveis.
- Evite objetos cobrindo a mão.
- Prefira um fundo simples e diferente da cor da pele.
- Mantenha a mão dentro da área indicada.
- Não fique muito perto nem muito longe da câmera.
- Sustente o gesto por alguns instantes.
- Trate a confiança como indicação, não como garantia absoluta.

## Problemas comuns

### O botão abre o explorador de arquivos

Isso acontece quando a câmera não está disponível ou quando o navegador não permite acesso. Verifique se você abriu o site em `http://localhost:5173`, permita o uso da câmera e feche outros programas que possam estar usando-a.

### A câmera foi negada

No Chrome ou Edge:

1. Clique no ícone ao lado do endereço do site.
2. Localize a permissão **Câmera**.
3. Escolha **Permitir**.
4. Atualize a página.

### A câmera não funciona no celular usando o endereço da rede

Os navegadores normalmente permitem câmera apenas em `localhost` ou em páginas HTTPS. Abrir um endereço como `http://192.168.x.x:5173` no celular pode mostrar o site, mas bloquear a câmera. Para uso real em outro dispositivo, publique a aplicação com HTTPS ou configure um certificado local.

### A página abre, mas nenhuma letra aparece

Confirme que a API continua aberta no primeiro terminal e acesse:

http://localhost:8000/health

Se esse endereço não responder, reinicie a API com:

```powershell
.\.venv\Scripts\Activate.ps1
python api\app.py
```

### Erro de conexão com a API

Por padrão, a interface procura a API na porta `8000`. Se a API estiver em outro endereço, crie um arquivo `.env` na raiz do projeto com:

```env
VITE_API_URL=http://localhost:8000
```

Depois reinicie `npm run dev`.

### `py` não é reconhecido

Tente:

```powershell
python --version
```

Se funcionar, substitua `py -3.11` por `python` nos comandos. Se também falhar, reinstale o Python marcando **Add Python to PATH**.

### `npm` não é reconhecido

Reinstale o Node.js LTS, reinicie o computador e abra um terminal novo.

### Porta 5173 ou 8000 já está em uso

Provavelmente uma cópia do projeto já está aberta. Procure outro terminal executando o site ou a API e pressione `Ctrl + C`. Depois tente novamente.

### A instalação do Python falha

Confirme que está usando Python 3.11. Algumas bibliotecas de visão computacional podem ainda não oferecer suporte imediato às versões mais novas do Python.

---

## Estrutura do projeto

```text
interlibras/
├── api/
│   ├── app.py                        # API Flask e reconhecimento
│   ├── requirements.txt              # Dependências Python
│   └── models/
│       └── libras_21_model.joblib    # Modelo já treinado
├── public/
│   └── brand/                        # Logo e imagens da identidade visual
├── scripts/
│   └── train_model.py                # Treinamento opcional para estudo
├── src/
│   ├── App.tsx                       # Interface e lógica da câmera
│   └── index.css                     # Estilos e responsividade
├── .env.example                      # Exemplo de configuração
├── package.json                      # Dependências e comandos do site
└── README.md                         # Este manual
```

## Endpoints da API

### `GET /health`

Verifica se a API está ativa e se o modelo foi carregado.

### `POST /predict`

Recebe uma imagem em Data URL/Base64 no corpo JSON:

```json
{
  "image": "data:image/jpeg;base64,..."
}
```

Exemplo de resposta:

```json
{
  "letter": "A",
  "confidence": 0.98
}
```

## Configuração opcional

Copie `.env.example` para `.env` somente se precisar alterar o endereço da API ou selecionar outro modelo:

```env
VITE_API_URL=http://localhost:8000
LIBRAS_MODEL=libras_21
```

Na configuração padrão, não é necessário criar banco de dados, executar Docker ou configurar serviços externos.

## Limitações conhecidas

- Reconhece uma mão por vez.
- Reconhece letras isoladas, não palavras ou frases completas.
- Não interpreta movimento, expressão facial ou contexto corporal.
- H, J, K, X e Z não fazem parte do modelo atual.
- A precisão pode variar fora dos datasets de treinamento e validação.
- O acesso à câmera em outros dispositivos requer uma origem segura, normalmente HTTPS.

## Próximos passos possíveis

- Modelo temporal para H, J, K, X e Z.
- Reconhecimento de palavras e sequências.
- Feedback visual dos pontos detectados na mão.
- Modo de aprendizagem e exercícios.
- Histórico local de tentativas.
- Empacotamento como aplicativo React Native.

---

## Resumo rápido para quem só quer rodar

Depois de instalar Python 3.11 e Node.js, abra dois terminais na pasta do projeto.

### Terminal 1

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r api\requirements.txt
python api\app.py
```

### Terminal 2

```powershell
npm install
npm run dev
```

Abra:

```text
http://localhost:5173
```

O modelo já está treinado. Não execute `scripts/train_model.py` para usar a aplicação.
