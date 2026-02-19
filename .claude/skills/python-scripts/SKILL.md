---
name: python-scripts
description: Création de scripts Python pour Klik&Go. Utiliser pour le traitement d'images, la génération de vidéos marketing, le traitement de données, le scraping, et l'automatisation. Inclut PIL/Pillow pour les images et ffmpeg pour la vidéo.
---

# Python Scripts — Klik&Go

## Quand utiliser Python (vs Node.js)
- Traitement d'images (PIL/Pillow) → Python
- Génération de vidéos marketing (PIL + ffmpeg) → Python
- Traitement de données CSV/Excel → Python
- Scripts de migration de données → Python ou Node (Prisma)
- Scraping de données → Python (requests + beautifulsoup)
- API et web → Node.js/Next.js (pas Python)

## Setup
```bash
pip install Pillow requests beautifulsoup4 pandas openpyxl
```

## Génération de vidéos marketing

### Pattern : frames PIL → vidéo ffmpeg
```python
from PIL import Image, ImageDraw, ImageFont
import subprocess
import os

# Config
WIDTH, HEIGHT = 1080, 1920  # format vertical (Stories/Reels)
BG_COLOR = "#0A0A0A"
PRIMARY = "#DC2626"
FONT_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

def create_frame(text, subtitle, frame_num, output_dir):
    """Crée une frame de la vidéo"""
    img = Image.new('RGB', (WIDTH, HEIGHT), BG_COLOR)
    draw = ImageDraw.Draw(img)

    # Titre
    font_big = ImageFont.truetype(FONT_PATH, 72)
    font_small = ImageFont.truetype(FONT_PATH, 36)

    # Texte centré
    bbox = draw.textbbox((0, 0), text, font=font_big)
    x = (WIDTH - (bbox[2] - bbox[0])) // 2
    draw.text((x, HEIGHT // 3), text, fill="white", font=font_big)

    # Sous-titre
    bbox2 = draw.textbbox((0, 0), subtitle, font=font_small)
    x2 = (WIDTH - (bbox2[2] - bbox2[0])) // 2
    draw.text((x2, HEIGHT // 2), subtitle, fill=PRIMARY, font=font_small)

    path = os.path.join(output_dir, f"frame_{frame_num:04d}.png")
    img.save(path)
    return path

def frames_to_video(frames_dir, output_path, fps=24, duration_per_frame=3):
    """Assemble les frames en vidéo avec ffmpeg"""
    cmd = [
        'ffmpeg', '-y',
        '-framerate', f'1/{duration_per_frame}',
        '-i', f'{frames_dir}/frame_%04d.png',
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-r', str(fps),
        output_path
    ]
    subprocess.run(cmd, check=True)

def add_audio(video_path, audio_path, output_path):
    """Ajoute une musique de fond"""
    cmd = [
        'ffmpeg', '-y',
        '-i', video_path,
        '-i', audio_path,
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-shortest',
        output_path
    ]
    subprocess.run(cmd, check=True)
```

### Script vidéo marketing Klik&Go
```python
# scripts/create_marketing_video.py
slides = [
    ("🥩 Klik&Go", "Commandez votre viande halal en ligne"),
    ("📱 Simple", "3 clics et c'est commandé"),
    ("⏱️ Rapide", "Prêt en 15 minutes"),
    ("💰 Même prix", "Tarifs identiques à la boucherie"),
    ("🎉 Essayez !", "klikandgo.fr"),
]

os.makedirs("frames", exist_ok=True)
for i, (title, sub) in enumerate(slides):
    create_frame(title, sub, i, "frames")

frames_to_video("frames", "klikgo_promo.mp4", duration_per_frame=3)
print("✅ Vidéo générée : klikgo_promo.mp4")
```

## Traitement d'images produits

### Optimisation photos
```python
from PIL import Image
import os

def optimize_product_image(input_path, output_path, max_size=(800, 600)):
    """Optimise une photo produit pour le web"""
    img = Image.open(input_path)

    # Resize en gardant le ratio
    img.thumbnail(max_size, Image.LANCZOS)

    # Fond blanc si transparent
    if img.mode in ('RGBA', 'P'):
        bg = Image.new('RGB', img.size, (255, 255, 255))
        bg.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
        img = bg

    # Sauvegarder en JPEG qualité 80
    img.save(output_path, 'JPEG', quality=80, optimize=True)

    original = os.path.getsize(input_path)
    optimized = os.path.getsize(output_path)
    print(f"✅ {input_path}: {original//1024}KB → {optimized//1024}KB ({100-optimized*100//original}% réduit)")

def batch_optimize(input_dir, output_dir):
    """Optimise toutes les images d'un dossier"""
    os.makedirs(output_dir, exist_ok=True)
    for f in os.listdir(input_dir):
        if f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')):
            optimize_product_image(
                os.path.join(input_dir, f),
                os.path.join(output_dir, f.rsplit('.', 1)[0] + '.jpg')
            )
```

### Génération de placeholder blur
```python
def generate_blur_placeholder(input_path):
    """Génère un placeholder flou en base64 pour next/image"""
    import base64
    from io import BytesIO

    img = Image.open(input_path)
    img = img.resize((10, 10), Image.LANCZOS)
    img = img.filter(ImageFilter.GaussianBlur(radius=2))

    buffer = BytesIO()
    img.save(buffer, format='JPEG', quality=20)
    b64 = base64.b64encode(buffer.getvalue()).decode()
    return f"data:image/jpeg;base64,{b64}"
```

## Traitement de données

### Import catalogue depuis CSV/Excel
```python
import pandas as pd

def import_catalogue_from_excel(filepath, shop_id):
    """Importe un catalogue boucher depuis Excel"""
    df = pd.read_excel(filepath)

    # Colonnes attendues : Nom, Prix, Catégorie, Poids, Unité
    products = []
    for _, row in df.iterrows():
        products.append({
            "name": str(row['Nom']).strip(),
            "priceCents": int(float(row['Prix']) * 100),
            "category": str(row.get('Catégorie', 'Autre')).strip(),
            "weight": float(row.get('Poids', 0)),
            "unit": str(row.get('Unité', 'kg')).strip(),
            "shopId": shop_id,
            "inStock": True,
        })

    print(f"✅ {len(products)} produits importés pour shop {shop_id}")
    return products
```

## Règles Python Klik&Go
- Toujours utiliser des virtual environments pour les scripts lourds
- Scripts dans le dossier /scripts à la racine du projet
- Ne JAMAIS mettre de secrets en dur (utiliser os.environ ou dotenv)
- Loguer les résultats (print avec ✅/❌)
- Toujours gérer les erreurs (try/except)
