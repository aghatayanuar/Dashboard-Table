import frappe
import json
import os

def after_install():
    create_dashboard_custom_report_tables_field()

def create_dashboard_custom_report_tables_field():

    doctype = "Dashboard"
    fieldname = "custom_report_tables"

    if frappe.db.exists("Custom Field", {
        "dt": doctype,
        "fieldname": fieldname
    }):
        print(f"Custom Field '{fieldname}' sudah ada di {doctype}")
        return

    cf = frappe.get_doc({
        "doctype": "Custom Field",
        "dt": doctype,
        "label": "Custom Report Tables",
        "fieldname": fieldname,
        "fieldtype": "Table",
        "options": "Dashboard Table Detail",
        "insert_before": "charts", 
        "owner": "Administrator"
    })

    cf.insert(ignore_permissions=True)

    frappe.db.commit()

    print(f"Custom Field '{fieldname}' berhasil ditambahkan ke {doctype}")
