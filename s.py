import os
from PyPDF2 import PdfWriter, PdfReader, PdfFileMerger, PdfMerger

file_name = "PZO90152E.pdf"

if not os.path.isfile(file_name):
    print(f"The file {file_name} does not exist.")
else:
    inputpdf = PdfReader(open(file_name, "rb"))


    # Merge the split PDF files
    merge_pdf = PdfMerger()

    for i in range(19, 44):
        
        writer = PdfWriter()
        writer.add_page(inputpdf.pages[i])
        with open("%s-page%s.pdf" % (file_name, i), "wb") as output_pdf:
            writer.write(output_pdf)
        merge_pdf.append(open("%s-page%s.pdf" % (file_name, i), "rb"))

    with open("part1.pdf", "wb") as output_pdf:
        merge_pdf.write(output_pdf)