#!/usr/bin/env python3
"""
Gerador de Ícone Simples - Better Seconds App
Gera ícones temporários com as iniciais "BS" e símbolo de câmera
"""

try:
    from PIL import Image, ImageDraw, ImageFont
    import os
except ImportError:
    print("❌ Erro: Pillow não instalado")
    print("Execute: pip3 install Pillow")
    exit(1)

def create_icon(size, output_path, with_symbol=False):
    """Cria um ícone simples"""
    # Cores do tema
    bg_color = (245, 245, 245)  # #f5f5f5
    text_color = (26, 26, 26)   # #1a1a1a
    accent_color = (220, 53, 69) # #dc3545 (vermelho)
    
    # Criar imagem
    img = Image.new('RGB', (size, size), bg_color)
    draw = ImageDraw.Draw(img)
    
    # Desenhar círculo de fundo (opcional)
    margin = size // 10
    circle_bbox = [margin, margin, size - margin, size - margin]
    
    # Tentar carregar uma fonte, senão usa a padrão
    try:
        font_size = size // 3
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", font_size)
        small_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", font_size // 3)
    except:
        font = ImageFont.load_default()
        small_font = ImageFont.load_default()
    
    # Desenhar bordas arredondadas (retângulo com cantos)
    corner_radius = size // 5
    draw.rounded_rectangle(
        [0, 0, size, size],
        radius=corner_radius,
        fill=bg_color,
        outline=text_color,
        width=size // 50
    )
    
    # Desenhar ícone de REC (círculo vermelho)
    if with_symbol:
        rec_size = size // 6
        rec_x = size // 2
        rec_y = size // 4
        draw.ellipse(
            [rec_x - rec_size//2, rec_y - rec_size//2, 
             rec_x + rec_size//2, rec_y + rec_size//2],
            fill=accent_color
        )
        
        # Texto "REC"
        rec_text = "REC"
        bbox = draw.textbbox((0, 0), rec_text, font=small_font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
        draw.text(
            (rec_x - text_width//2 + rec_size, rec_y - text_height//2),
            rec_text,
            fill=accent_color,
            font=small_font
        )
    
    # Desenhar iniciais "BS"
    text = "BS"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    
    # Centralizar texto
    x = (size - text_width) // 2
    y = (size - text_height) // 2 + (size // 8 if with_symbol else 0)
    
    draw.text((x, y), text, fill=text_color, font=font)
    
    # Desenhar câmera simplificada (símbolo)
    cam_size = size // 5
    cam_x = size // 2
    cam_y = size - size // 4
    
    # Corpo da câmera (retângulo)
    cam_body = [
        cam_x - cam_size, cam_y - cam_size//2,
        cam_x + cam_size, cam_y + cam_size//2
    ]
    draw.rounded_rectangle(cam_body, radius=cam_size//10, outline=text_color, width=size//80)
    
    # Lente da câmera (círculo)
    lens_size = cam_size // 2
    draw.ellipse(
        [cam_x - lens_size//2, cam_y - lens_size//2,
         cam_x + lens_size//2, cam_y + lens_size//2],
        outline=text_color,
        width=size//100
    )
    
    # Salvar
    img.save(output_path, 'PNG', quality=100)
    print(f"✅ Criado: {output_path} ({size}x{size})")

def main():
    """Gera todos os ícones necessários"""
    print("🎨 Gerando ícones para Better Seconds App...\n")
    
    assets_dir = os.path.join(os.path.dirname(__file__), 'assets', 'images')
    
    # Criar diretório se não existir
    os.makedirs(assets_dir, exist_ok=True)
    
    # Fazer backup dos ícones antigos
    for filename in ['icon.png', 'adaptive-icon.png', 'splash-icon.png']:
        old_path = os.path.join(assets_dir, filename)
        if os.path.exists(old_path):
            backup_path = old_path.replace('.png', '.backup.png')
            os.rename(old_path, backup_path)
            print(f"📦 Backup: {filename} → {filename.replace('.png', '.backup.png')}")
    
    print()
    
    # Gerar ícones
    create_icon(1024, os.path.join(assets_dir, 'icon.png'), with_symbol=True)
    create_icon(1024, os.path.join(assets_dir, 'adaptive-icon.png'), with_symbol=False)
    create_icon(1000, os.path.join(assets_dir, 'splash-icon.png'), with_symbol=True)
    
    print("\n✨ Ícones gerados com sucesso!")
    print("\n📝 Próximos passos:")
    print("1. Limpar build anterior:")
    print("   cd android && ./gradlew clean")
    print("\n2. Gerar novo APK:")
    print("   ./gradlew assembleRelease")
    print("\n3. Desinstalar app antigo do celular:")
    print("   adb uninstall com.abauruel.bettersecondsapp")
    print("\n4. Instalar novo APK:")
    print("   adb install app/build/outputs/apk/release/app-release.apk")
    print("\n💡 Ou customize os ícones em:")
    print(f"   {assets_dir}/")

if __name__ == '__main__':
    main()
