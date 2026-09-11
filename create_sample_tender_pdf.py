from create_sample_pdf import create_pdf

tender_lines = [
    "GOVERNMENT E-MARKETPLACE (GeM) - BID NOTICE",
    "Bid Number: GEM/2026/B/882190",
    "Item Title: Supply & Installation of Integrated Security Cameras",
    "Procurement Category: Goods",
    "Department: Central Industrial Security Force",
    "Estimated Bid Value: INR 75,00,000",
    "Mandatory Eligibility Requirements:",
    "1. Udyam MSME Registration Certificate is mandatory for MSE purchase preference.",
    "2. Active GSTN Registration with regular filing record is required.",
    "3. Permanent Account Number (PAN) and Income Tax Return compliance.",
    "4. Clean debarment record - bidder must not be blacklisted by any Government department.",
]

create_pdf("sample_tender_notice.pdf", tender_lines)
print("Created sample_tender_notice.pdf")
