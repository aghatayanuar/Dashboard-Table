import frappe
from frappe import _

@frappe.whitelist()
def run_limited_report(report_name, filters=None, limit=3):
    """
    Wrapper untuk frappe.desk.query_report.run
    Mengembalikan maksimal 3 baris saja
    """

    if not report_name:
        frappe.throw(_("Report name is required"))

    if isinstance(filters, str):
        filters = frappe.parse_json(filters)

    result = frappe.get_attr("frappe.desk.query_report.run")(
        report_name=report_name,
        filters=filters,
    )

    if not result:
        return {}

    columns = result.get("columns", [])
    data = result.get("result", [])

    limited_data = data[:int(limit)]

    return {
        "columns": columns,
        "result": limited_data
    }