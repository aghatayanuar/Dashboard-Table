console.log("dashboard_table.js loaded");

if (!document.getElementById("custom-dashboard-table-style")) {
    const style = document.createElement("style");
    style.id = "custom-dashboard-table-style";
    style.innerHTML = `

        .custom-report-widget-group .widget-body {
            padding: 0 !important;
        }

        .custom-report-widget-group .widget-footer {
            display: none !important;
        }

        .custom-report-widget-group .widget-head {
            margin-bottom: 0 !important;
        }

        .custom-report-widget-group .widget {
            overflow: hidden;
            min-height: 0px;
        }

        .custom-report-widget-group .table-scroll-container {
            width: 100%;
            max-height: 260px;
            overflow-x: auto;
            overflow-y: auto;
        }

        .custom-report-widget-group table {
            font-size: 11px;
            border-collapse: collapse;
            width: max-content;
            min-width: 100%;
            margin: 0 !important;
        }

        .custom-report-widget-group th,
        .custom-report-widget-group td {
            white-space: nowrap !important;
            padding: 4px 6px !important;
        }

        .custom-report-widget-group thead th {
            position: sticky;
            top: 0;
            background: #fff;
            z-index: 2;
        }

    `;
    document.head.appendChild(style);
}

frappe.router.on("change", () => {

    const route = frappe.get_route();
    if (route[0] !== "dashboard-view") return;

    const dashboard_name = route[1];
    console.log("Dashboard route detected:", dashboard_name);

    wait_for_dashboard_render(dashboard_name);
});


function wait_for_dashboard_render(dashboard_name) {

    const interval = setInterval(async () => {

        const dashboard_graph = document.querySelector(".dashboard-graph");
        if (!dashboard_graph) return;

        clearInterval(interval);

        console.log("Dashboard DOM ready:", dashboard_name);

        if (dashboard_graph.querySelector(".custom-report-widget-group")) {
            console.log("Custom group already rendered");
            return;
        }

        const dashboard_doc = await frappe.db.get_doc(
            "Dashboard",
            dashboard_name
        );

        if (!dashboard_doc.custom_report_tables?.length) {
            console.log("No custom_report_tables found");
            return;
        }

        render_custom_group(dashboard_graph, dashboard_doc);

    }, 300);
}


async function render_custom_group(dashboard_graph, dashboard_doc) {

    const group = document.createElement("div");
    group.className = "widget-group custom-report-widget-group";

    group.innerHTML = `
        <div class="widget-group-head">
            <div class="widget-group-control"></div>
        </div>
        <div class="widget-group-body grid-col-2"></div>
    `;

    dashboard_graph.insertBefore(group, dashboard_graph.firstChild);

    const body = group.querySelector(".widget-group-body");

    for (let row of dashboard_doc.custom_report_tables) {

        if (!row.report_table) continue;

        const table_doc = await frappe.db.get_doc(
            "Dashboard Table",
            row.report_table
        );

        const widget = document.createElement("div");
        widget.className =
            "widget dashboard-widget-box";

        widget.innerHTML = `
            <div class="widget-head">
                <div class="widget-label">
                    <div class="widget-title">
                        <span class="ellipsis">
                            ${table_doc.report_name}
                        </span>
                    </div>
                </div>
            </div>
            <div class="widget-body text-muted">
                Loading...
            </div>
            <div class="widget-footer"></div>
        `;

        body.appendChild(widget);

        try {

            const result = await frappe.call({
                method: "frappe.desk.query_report.run",
                args: {
                    report_name: table_doc.report_name,
                    filters: JSON.parse(table_doc.filter_json || "{}")
                }
            });

            if (!result.message) {
                widget.querySelector(".widget-body").innerHTML = "No data";
                continue;
            }

            const columns = result.message.columns || [];
            const data = (result.message.result || [])
                .slice(0, table_doc.limit_rows || 3);

            if (!data.length) {
                widget.querySelector(".widget-body").innerHTML = "No rows found";
                continue;
            }

            const table_html = `
                <div class="table-scroll-container">
                    <table class="table table-bordered table-sm mb-0">
                        <thead>
                            <tr>
                                ${columns.map(c => `<th>${c.label}</th>`).join("")}
                            </tr>
                        </thead>
                        <tbody>
                            ${data.map(row =>
                                `<tr>${
                                    columns.map(c =>
                                        `<td>${row[c.fieldname] ?? ""}</td>`
                                    ).join("")
                                }</tr>`
                            ).join("")}
                        </tbody>
                    </table>
                </div>
            `;


            widget.querySelector(".widget-body").innerHTML = table_html;

        } catch (err) {

            console.error("Report load failed:", err);
            widget.querySelector(".widget-body").innerHTML =
                "Failed to load report";
        }
    }
}
