import fitz  # PyMuPDF
from PIL import Image, ImageDraw
import os

os.makedirs("test_assets", exist_ok=True)

# 1. Text-based PDF (has PyMuPDF text layer)
doc_text = fitz.open()
page = doc_text.new_page(width=600, height=800)
text = """
GOVERNMENT OF INDIA
MINISTRY OF MICRO, SMALL AND MEDIUM ENTERPRISES
UDYAM REGISTRATION CERTIFICATE

UDYAM REGISTRATION NUMBER: UDYAM-MH-12-0077889
NAME OF ENTERPRISE: ACME SOLAR TECHNOLOGIES PRIVATE LIMITED
ENTERPRISE TYPE: MICRO
MAJOR ACTIVITY: MANUFACTURING
CONSTITUTION: PRIVATE LIMITED COMPANY
DATE OF INCORPORATION: 15/08/2021
CIN: U72900MH2021PTC123456
EPFO NUMBER: MH/BAN/0012345/000
ESIC NUMBER: 31000123450000101
REGISTERED ADDRESS: PLOT 45 INDUSTRIAL AREA ANDHERI EAST MUMBAI MAHARASHTRA 400093
"""
page.insert_text((50, 60), text, fontsize=12)
doc_text.save("test_assets/udyam_text.pdf")
doc_text.close()
print("Created test_assets/udyam_text.pdf")

# 2. Scanned / Image-only PDF (No text layer -> must trigger PaddleOCR)
img_scanned = Image.new("RGB", (800, 1000), color=(255, 255, 255))
draw = ImageDraw.Draw(img_scanned)
draw.text((50, 50), "GOVERNMENT OF INDIA - UDYAM CERTIFICATE", fill=(0, 0, 0))
draw.text((50, 100), "UDYAM REGISTRATION NUMBER: UDYAM-MH-12-0077889", fill=(0, 0, 0))
draw.text((50, 150), "NAME: ACME SOLAR TECHNOLOGIES PRIVATE LIMITED", fill=(0, 0, 0))
draw.text((50, 200), "TYPE: MICRO ENTERPRISE", fill=(0, 0, 0))
draw.text((50, 250), "DATE OF REGISTRATION: 15/08/2021", fill=(0, 0, 0))
img_scanned.save("test_assets/scanned_page.png")

doc_scanned = fitz.open()
img_doc = fitz.open("test_assets/scanned_page.png")
rect = img_doc[0].rect
pdfbytes = img_doc.convert_to_pdf()
img_pdf = fitz.open("pdf", pdfbytes)
doc_scanned.insert_pdf(img_pdf)
doc_scanned.save("test_assets/udyam_scanned.pdf")
doc_scanned.close()
print("Created test_assets/udyam_scanned.pdf (scanned image-only PDF)")

# 3. GST Certificate (JPG Image -> must trigger PaddleOCR)
img_gst = Image.new("RGB", (800, 600), color=(255, 255, 255))
draw_gst = ImageDraw.Draw(img_gst)
draw_gst.text((50, 50), "GOVERNMENT OF INDIA - GST REGISTRATION CERTIFICATE", fill=(0, 0, 0))
draw_gst.text((50, 120), "Registration Number (GSTIN): 27AABCA1234A1Z5", fill=(0, 0, 0))
draw_gst.text((50, 180), "Legal Name: ACME SOLAR TECHNOLOGIES PRIVATE LIMITED", fill=(0, 0, 0))
draw_gst.text((50, 240), "Constitution of Business: Private Limited Company", fill=(0, 0, 0))
draw_gst.text((50, 300), "Date of Registration: 18/09/2021", fill=(0, 0, 0))
img_gst.save("test_assets/gst_cert.jpg", "JPEG")
print("Created test_assets/gst_cert.jpg")

# 4. PAN Card (PNG Image -> must trigger PaddleOCR)
img_pan = Image.new("RGB", (700, 450), color=(255, 255, 255))
draw_pan = ImageDraw.Draw(img_pan)
draw_pan.text((50, 50), "INCOME TAX DEPARTMENT - GOVT OF INDIA", fill=(0, 0, 0))
draw_pan.text((50, 120), "Permanent Account Number Card", fill=(0, 0, 0))
draw_pan.text((50, 180), "PAN: AABCA1234A", fill=(0, 0, 0))
draw_pan.text((50, 240), "Name: ACME SOLAR TECHNOLOGIES PRIVATE LIMITED", fill=(0, 0, 0))
draw_pan.text((50, 300), "Date of Incorporation: 15/08/2021", fill=(0, 0, 0))
img_pan.save("test_assets/pan_card.png", "PNG")
print("Created test_assets/pan_card.png")
