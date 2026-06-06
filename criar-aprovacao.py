"""
criar-aprovacao.py
Cria um link de aprovação para o cliente revisar o criativo.

Uso:
  python criar-aprovacao.py

O script vai perguntar:
  - Qual cliente
  - Quais imagens
  - Qual legenda
"""
import os, json, uuid, glob
from pathlib import Path
from datetime import datetime

BASE_DIR = Path(__file__).parent
CLIENTES_DIR = BASE_DIR / "clientes"
DATA_DIR = BASE_DIR / "data" / "pendentes"
DATA_DIR.mkdir(parents=True, exist_ok=True)

# ── Menu de clientes ──────────────────────────────────────────────────────────
def listar_clientes():
    clientes = [d.name for d in CLIENTES_DIR.iterdir() if d.is_dir() and d.name != "_modelo"]
    return sorted(clientes)

def menu_clientes():
    clientes = listar_clientes()
    if not clientes:
        print("❌ Nenhum cliente cadastrado. Adicione uma pasta em clientes/")
        exit(1)

    print("\n" + "="*50)
    print("  SISTEMA DE APROVAÇÃO — Grupo 10+")
    print("="*50)
    print("\nSelecione o cliente:\n")
    for i, c in enumerate(clientes, 1):
        print(f"  {i}. {c}")
    print(f"  {len(clientes)+1}. ➕ Adicionar novo cliente")
    print()

    while True:
        try:
            escolha = int(input("Digite o número: "))
            if 1 <= escolha <= len(clientes):
                return clientes[escolha - 1]
            elif escolha == len(clientes) + 1:
                return adicionar_cliente()
        except ValueError:
            pass
        print("Opção inválida. Tente novamente.")

def adicionar_cliente():
    nome = input("\nNome do cliente (ex: nome-da-empresa): ").strip().lower().replace(" ", "-")
    pasta = CLIENTES_DIR / nome
    pasta.mkdir(parents=True, exist_ok=True)
    modelo = CLIENTES_DIR / "_modelo" / ".env"
    import shutil
    shutil.copy(modelo, pasta / ".env")
    print(f"\n✅ Cliente '{nome}' criado!")
    print(f"📁 Preencha as credenciais em: clientes/{nome}/.env")
    print("   (Rode o setup-instagram para obter as credenciais)\n")
    return nome

# ── Seleção de imagens ────────────────────────────────────────────────────────
def selecionar_imagens():
    print("\nCaminho das imagens:")
    print("  - Pasta inteira:  C:\\Users\\Wiliam\\Desktop\\posts\\")
    print("  - Arquivo único:  C:\\Users\\Wiliam\\Desktop\\post.png")
    print()
    entrada = input("Cole o caminho: ").strip().strip('"')

    if os.path.isdir(entrada):
        imagens = sorted(glob.glob(os.path.join(entrada, "*.png")) +
                        glob.glob(os.path.join(entrada, "*.jpg")) +
                        glob.glob(os.path.join(entrada, "*.jpeg")))
    elif os.path.isfile(entrada):
        imagens = [entrada]
    else:
        print("❌ Caminho não encontrado.")
        return selecionar_imagens()

    if not imagens:
        print("❌ Nenhuma imagem encontrada nessa pasta.")
        return selecionar_imagens()

    print(f"\n✅ {len(imagens)} imagem(ns) encontrada(s):")
    for img in imagens:
        print(f"   • {os.path.basename(img)}")

    return imagens

# ── Upload das imagens ────────────────────────────────────────────────────────
def hospedar_imagem(caminho: str) -> str:
    import urllib.request
    print(f"  Enviando {os.path.basename(caminho)}...", end=" ")
    with open(caminho, "rb") as f:
        import http.client, mimetypes
        boundary = "----FormBoundary7MA4YWxkTrZu0gW"
        body = (
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="reqtype"\r\n\r\nfileupload\r\n'
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="fileToUpload"; filename="{os.path.basename(caminho)}"\r\n'
            f"Content-Type: image/png\r\n\r\n"
        ).encode() + f.read() + f"\r\n--{boundary}--\r\n".encode()

    req = urllib.request.Request(
        "https://catbox.moe/user/api.php",
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    )
    import ssl
    ctx = ssl._create_unverified_context()
    with urllib.request.urlopen(req, context=ctx, timeout=60) as r:
        url = r.read().decode().strip()
    print(f"✅ {url}")
    return url

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    cliente = menu_clientes()
    imagens_locais = selecionar_imagens()

    print("\nLegenda do post (Enter duas vezes para terminar):")
    linhas = []
    while True:
        linha = input()
        if linha == "" and linhas and linhas[-1] == "":
            break
        linhas.append(linha)
    legenda = "\n".join(linhas).strip()

    print("\n📤 Hospedando imagens para o link de aprovação...")
    urls = [hospedar_imagem(img) for img in imagens_locais]

    brief_id = str(uuid.uuid4())[:8]
    brief = {
        "id": brief_id,
        "cliente": cliente.replace("-", " ").title(),
        "clienteSlug": cliente,
        "imagens": urls,
        "legenda": legenda,
        "status": "pendente",
        "criadoEm": datetime.now().isoformat(),
    }

    (DATA_DIR / f"{brief_id}.json").write_text(json.dumps(brief, indent=2, ensure_ascii=False))

    base_url = os.getenv("APPROVAL_BASE_URL", "https://approval.grupo10mais.com.br")
    link = f"{base_url}/aprovar/{brief_id}"

    print("\n" + "="*50)
    print("  ✅ LINK DE APROVAÇÃO GERADO!")
    print("="*50)
    print(f"\n🔗 {link}")
    print(f"\nEnvie esse link para: {brief['cliente']}")
    print("Quando o cliente aprovar, o post vai direto para o Instagram!")
    print()

if __name__ == "__main__":
    main()
