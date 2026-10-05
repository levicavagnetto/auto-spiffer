"""Sample data for the GUI mockups. Nothing here is read from real files."""

# (date, invoice, report description, matched ClaimForm tire, qty, pdf, status)
ROWS = [
    ("09/05/2026", "214341", "235/50R18 97H GEN AltiMAX RT45 65K 235/50R18 BW...", "General Altimax RT45 - Passenger Tires", "4", "Yes", "Ready"),
    ("09/14/2026", "214533", "LT265/75R16/10 123/120S NOK OUTPOST NAT BW 60K...", "Nokian Outpost nAT - Light Truck Tires", "4", "Yes", "Ready"),
    ("09/16/2026", "214629", "LT255/75R17/6 111/108S TOY OPEN COUNTRY A/T III...", "Toyo Open Country A/T III - Light Truck Tires", "4", "Yes", "Ready"),
    ("09/16/2026", "214632", "NIT TERRA GRAPPLER G3 275/60R20XL 116T", "Nitto Terra Grappler G3 - Light Truck Tires", "4", "Yes", "Ready"),
    ("09/17/2026", "214645", "HER STRONG GUARD ST ST205/75R14/8 105/101N", "Hercules Strong Guard ST Trailer - BOAT TRAILER TIRES", "1", "Yes", "Ready"),
    ("09/17/2026", "214655", "245/55R19 103H NOK ONE BW 80K 245/55R19 103H (80K)", "(choose a tire...)", "4", "Yes", "Attention"),
    ("09/17/2026", "214659", "225/65R17 102H CON SECURECONTACT AW BW 60K...", "Continental SecureContact AW - Passenger Tires", "4", "Yes", "Ready"),
    ("09/17/2026", "214679", "225/55R17XL 101V NOK REMEDY WRG5 BW 60K...", "Nokian Remedy WRG5 - Passenger Tires", "4", "Yes", "Ready"),
    ("09/19/2026", "214738", "205/60R16 92V FAL AKLIMATE BW 65K 205/60R16 BW...", "Falken Aklimate - Passenger Tires", "4", "Yes", "Ready"),
    ("09/19/2026", "214745", "205/40ZR17XL 84W IRON iMOVE GEN 3 AS 40K...", "(not on the ClaimForm)", "1", "Yes", "Not eligible"),
    ("09/25/2026", "214962", "275/55R20XL 117T HER TERRA TRAC AT X-JOURNEY 3PMS 60K", "(choose a tire...)", "4 *", "Yes", "Attention"),
    ("09/26/2026", "214983", "265/70R16 112T FAL WILDPEAK A/T4W BW 65K...", "Falken Wildpeak A/T4W - Light Truck Tires", "4", "No PDF", "Problem"),
    ("09/28/2026", "215024", "225/65R17 102H NOK NORDMAN SOLSTICE 4 BW 50K...", "(not on the ClaimForm)", "4 *", "Yes", "Not eligible"),
    ("09/30/2026", "215081", "215/60R16 95T GEN AltiMAX RT45 75K 215/60R16 BW...", "General Altimax RT45 - Passenger Tires", "2", "Yes", "Ready"),
]

TIRES = [
    ("Continental SecureContact AW - Passenger Tires", "$3.00"),
    ("Continental TerrainContact A/T - Light Truck Tires", "$2.00"),
    ("Continental TrueContact Tour 54 - Passenger Tires", "$2.00"),
    ("Falken Aklimate - Passenger Tires", "$2.00"),
    ("Falken Wildpeak A/T4W - Light Truck Tires", "$2.00"),
    ("General Altimax RT45 - Passenger Tires", "$3.00"),
    ("General Grabber A/TX - Light Truck Tires", "$3.00"),
    ("Hercules Strong Guard ST Trailer - BOAT TRAILER TIRES", "$1.00"),
    ("Hercules Terra Trac A/T - Light Truck Tires", "$2.00"),
    ("Hercules Terra Trac Cross-V AW - Light Truck Tires", "$2.00"),
    ("Nitto Terra Grappler G3 - Light Truck Tires", "$2.00"),
    ("Nokian One HT - Light Truck Tires", "$2.00"),
    ("Nokian Outpost nAT - Light Truck Tires", "$2.00"),
    ("Nokian Remedy WRG5 - Passenger Tires", "$2.00"),
    ("Toyo Open Country A/T III - Light Truck Tires", "$2.00"),
    ("Toyo Open Country R/T - Light Truck Tires", "$2.00"),
]

LOG = [
    "12:03:11   214341   General Altimax RT45  x4     added, verified",
    "12:03:19   214341   uploaded 214341.pdf           attached",
    "12:03:27   214533   Nokian Outpost nAT  x4        added, verified",
    "12:03:35   214533   uploaded 214533.pdf           attached",
    "12:03:43   214629   Toyo Open Country A/T III  x4 added, verified",
    "12:03:51   214629   uploaded 214629.pdf           attached",
    "12:03:59   214632   Nitto Terra Grappler G3  x4   added, verified",
    "12:04:07   214632   uploaded 214632.pdf           attached",
    "12:04:15   214645   Hercules Strong Guard ST  x1  added, verified",
    "12:04:23   214645   uploaded 214645.pdf           attached",
    "12:04:31   214655   skipped (needs attention, not resolved)",
    "12:04:32   214659   Continental SecureContact AW  x4  entering...",
]
