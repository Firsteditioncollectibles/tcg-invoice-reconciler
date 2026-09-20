"""Synthetic marketplace grid: separate metadata boxes, two-line cards, centered numeric cells."""
from pathlib import Path
import json, subprocess
import fitz
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
for n,f in [('Fixture','Regular'),('FixtureBold','Bold')]:
    pdfmetrics.registerFont(TTFont(n,'node_modules/pdfjs-dist/standard_fonts/LiberationSans-'+f+'.ttf'))
root=Path('tests/fixtures'); root.mkdir(exist_ok=True)
w,h=1428,1626
c=canvas.Canvas(str(root/'marketplace-text.pdf'),pagesize=(w,h))
c.setTitle('Synthetic marketplace order - layout regression')
def text(x,y,s,bold=False,size=21):
    c.setFillColorRGB(.3,.3,.3); c.setFont('FixtureBold' if bold else 'Fixture',size); c.drawString(x,h-y-size,s)
def rule(x,y,width,height,fill=None):
    c.setStrokeColorRGB(.83,.83,.83)
    if fill: c.setFillColorRGB(*fill)
    c.rect(x,h-y-height,width,height,fill=bool(fill),stroke=1)
rule(8,5,1410,105,(.97,.97,.97))
for x,label,value in [(30,'ORDER DATE','September 20, 2026'),(312,'CHANNEL','TCG Marketplace'),(594,'ORDER NUMBER','SYNTHETIC-001-TEST')]:text(x,26,label,True);text(x,58,value)
for x,label in [(30,'ORDER SUMMARY'),(376,'SHIP TO'),(722,'BILL TO'),(1068,'SHIPPED AND SOLD BY')]:text(x,142,label,True)
for i,(label,value) in enumerate([('Quantity:','21'),('Subtotal:','$68.02'),('Shipping:','$1.48'),('Sales Tax (CO):','$6.35'),('Total:','$75.85')]):text(30,178+i*36,label);text(267,178+i*36,value)
for i,s in enumerate(['Example Recipient','123 Sample Avenue','Example City, EX 12345','US']):text(376,178+i*36,s)
for i,s in enumerate(['Example Buyer','456 Fiction Lane','Example Town','EX1 1AA','GB']):text(722,178+i*36,s)
text(1068,178,'Sample Card Store');text(1068,230,'SHIPPED WITH TRACKING:',True,size=18);text(1068,267,'TEST-TRACKING-001');text(1068,303,'Standard delivery');text(1068,339,'Synthetic test order')
rule(30,407,1370,72,(.93,.93,.93))
for x,s in [(42,'ITEMS'),(532,'DETAILS'),(1036,'PRICE'),(1224,'QUANTITY')]:text(x,430,s,True)
quantities=[1,1,3,4,3,1,2,1,1,1,1,1,1]
prices=['1.99','6.99','0.99','0.99','4.99','2.25','3.75','3.50','1.65','2.50','4.50','13.49','1.75']
names=['Pikachu 025/165','Charizard ex 199/165','Bulbasaur 001/165','Squirtle 007/165','Eevee 133/165','Snorlax 143/165','Mew ex 151/165','Dragonair 148/165','Gengar 094/165','Poliwhirl 061/165','Charmander 004/165','Psyduck 054/165','Lapras 131/165']
for i,(name,q,p) in enumerate(zip(names,quantities,prices)):
    y=479+i*86;rule(30,y,1370,86,(.98,.98,.98) if i%2 else (1,1,1))
    for x in [522,1026,1212]:rule(x,y,0,86)
    rule(43,y+12,40,58,(.8,.87,.94))
    text(103,y+12,name);text(103,y+44,'Synthetic Test Set')
    text(532,y+12,'Rarity: Ultra Rare');text(532,y+44,'Condition: Near Mint Holofoil')
    text(1036,y+28,'$'+p);text(1302,y+28,str(q))
c.save()
subprocess.run(['pdftoppm','-png','-scale-to','2200','-singlefile',str(root/'marketplace-text.pdf'),str(root/'marketplace-screenshot')],check=True)
c=canvas.Canvas(str(root/'marketplace-scanned.pdf'),pagesize=(w,h));c.drawImage(str(root/'marketplace-screenshot.png'),0,0,width=w,height=h);c.save()
with fitz.open(root/'marketplace-text.pdf') as d:
    p=d[0]; boxes=[{'text':t[4],'x':t[0],'y':t[1],'width':t[2]-t[0],'height':t[3]-t[1]} for t in p.get_text('words')]
    (root/'marketplace-layout.json').write_text(json.dumps({'width':w,'height':h,'boxes':boxes},indent=2))
print('Created synthetic marketplace PNG, native/scanned PDFs and positioned-text fixture.')
