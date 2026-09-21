"""Rebuild synthetic OCR fixtures. Requires reportlab, Pillow and pdftoppm."""
from pathlib import Path
import subprocess
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
pdfmetrics.registerFont(TTFont('TestSans','node_modules/pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf'))
pdfmetrics.registerFont(TTFont('TestSansBold','node_modules/pdfjs-dist/standard_fonts/LiberationSans-Bold.ttf'))
Path('tests/fixtures').mkdir(exist_ok=True,parents=True)
p='tests/fixtures/tcgplayer-text.pdf'
c=canvas.Canvas(p,pagesize=A4);c.setTitle('Synthetic TCGplayer-shaped test receipt')
c.setFont('TestSansBold',24);c.drawString(36,800,'TCGplayer')
c.setFont('TestSans',12)
for n,s in enumerate(['Order Number: ABC123-DEF456-789012','Order Date: September 19, 2026','Seller: Example Cards','Ship To:','Sample Buyer','123 Example Road','Example City, EX 12345']):c.drawString(36,764-n*20,s)
c.setFont('TestSansBold',10)
for x,s in [(36,'Quantity'),(93,'Description'),(433,'Price'),(515,'Total')]:c.drawString(x,592,s)
c.setFont('TestSans',11)
rows=[('2','Pikachu 025/165 Near Mint','$1.25','$2.50'),('1','Charizard ex 199/165 Near Mint Holofoil','$10.00','$10.00'),('1','Pikachu 025/165 Near Mint','$1.25','$1.25')]
for i,row in enumerate(rows):
 for x,s in zip([36,93,433,515],row):c.drawString(x,568-i*28,s)
for i,s in enumerate(['Subtotal: $13.75','Shipping: $1.99','Sales Tax: $0.80','Order Total: $16.54']):c.drawString(385,445-i*23,s)
c.setFont('TestSans',9);c.drawString(36,60,'SYNTHETIC TEST FIXTURE - not an actual transaction');c.save()
subprocess.run(['pdftoppm','-png','-scale-to','2200','-singlefile',p,'tests/fixtures/tcgplayer-screenshot'],check=True)
c=canvas.Canvas('tests/fixtures/tcgplayer-scanned.pdf',pagesize=A4);c.drawImage('tests/fixtures/tcgplayer-screenshot.png',0,0,width=A4[0],height=A4[1]);c.save()
