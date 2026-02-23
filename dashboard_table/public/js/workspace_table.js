console.log("workspace_table.js loaded");

if (!document.getElementById("custom-workspace-table-style")) {
    const style = document.createElement("style");
    style.id = "custom-workspace-table-style";
    style.innerHTML = `
        /* GRID WRAPPER */
        .custom-report-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 16px;
            margin-top: 15px;
            width: 100%;
        }

        /* Responsive */
        @media (max-width: 992px) {
            .custom-report-grid {
                grid-template-columns: 1fr;
            }
        }

        /* IMPORTANT: prevent grid child overflow */
        .custom-report-widget {
            min-width: 0;
            width: 100%;
        }

        .custom-report-widget-group {
            width: 100%;
            overflow: hidden;
        }

        .custom-report-widget-group .widget-body {
            padding: 0 !important;
            overflow: hidden;
        }

        .custom-report-widget-group .widget-footer {
            display: none !important;
        }

        .custom-report-widget-group .widget-head {
            margin-bottom: 0 !important;
        }

        /* SCROLL ONLY INSIDE TABLE AREA */
        .custom-report-widget-group .table-scroll-container {
            width: 100%;
            max-width: 100%;
            max-height: 260px;
            overflow-x: auto;
            overflow-y: auto;
        }

        .custom-report-widget-group table {
            font-size: 11px;
            border-collapse: collapse;
            width: 100%;
            table-layout: auto;
        }

        .custom-report-widget-group th,
        .custom-report-widget-group td {
            padding: 4px 6px !important;
            white-space: nowrap;
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

// Trigger init saat route change
frappe.router.on("change", () => {
    console.log("Init custom tables triggered");
    init_module_tables();
});

function init_module_tables() {
    const route = frappe.get_route(true); 
    if (!route || route[0] !== "Workspaces" || !route[1]) {
        setTimeout(init_module_tables, 200); 
        return;
    }

    const module_name = route[1];
    console.log("Module route detected:", module_name);

    if( module_name === "Home" ){
        return;
    }

    wait_for_module_render(module_name);
}

async function wait_for_module_render(module_name) {

    let tries = 0;
    const MAX_TRIES = 20; // 20 x 150ms ≈ 3 detik

    const interval = setInterval(async () => {

        const workspace_container = document.querySelector(
            ".codex-editor__redactor"
        );

        if (!workspace_container) {
            return;
        }

        const onboarding = document.querySelector(
            `div[onboarding_name="${module_name}"]`
        );

        // 🔵 Kalau onboarding ada → langsung lanjut
        // 🔵 Kalau belum ada tapi belum timeout → tunggu
        if (!onboarding && tries < MAX_TRIES) {
            tries++;
            return;
        }

        clearInterval(interval);

        // ✅ HAPUS GRID LAMA (anti duplicate)
        document
            .querySelectorAll(
                `.custom-report-grid-block[data-module="${module_name}"]`
            )
            .forEach(el => el.remove());

        try {

            const dashboard_doc = await frappe.db.get_doc(
                "Dashboard",
                module_name
            );

            if (!dashboard_doc.custom_report_tables?.length) {
                return;
            }

            // 🔎 Tentukan anchor
            let insert_after_block = null;

            if (onboarding) {
                insert_after_block = onboarding.closest(".ce-block");
            }

            // 🔵 Buat wrapper grid
            const grid_block = document.createElement("div");
            grid_block.className = "ce-block custom-report-grid-block";
            grid_block.dataset.module = module_name;

            grid_block.innerHTML = `
                <div class="ce-block__content">
                    <div class="custom-report-grid"></div>
                </div>
            `;

            if (insert_after_block) {
                insert_after_block.parentNode.insertBefore(
                    grid_block,
                    insert_after_block.nextSibling
                );
            } else {
                workspace_container.insertBefore(
                    grid_block,
                    workspace_container.firstChild
                );
            }

            const grid = grid_block.querySelector(".custom-report-grid");

            // 🔁 LOOP REPORT
            for (const row of dashboard_doc.custom_report_tables) {

                if (!row.report_table) continue;

                try {

                    const table_doc = await frappe.db.get_doc(
                        "Dashboard Table",
                        row.report_table
                    );

                    let filters = {};
                    if (table_doc.filter_json) {
                        try {
                            filters = JSON.parse(table_doc.filter_json);
                        } catch (e) {}
                    }

                    const result = await frappe.call({
                        method: "frappe.desk.query_report.run",
                        args: {
                            report_name: table_doc.report_name,
                            filters: filters
                        }
                    });

                    if (!result.message) continue;

                    const columns = result.message.columns || [];
                    const raw_data = result.message.result || [];

                    const data = raw_data.slice(
                        0,
                        table_doc.limit_rows || 3
                    );

                    if (!data.length) continue;

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

                    const wrapper = document.createElement("div");
                    wrapper.className = "custom-report-widget";

                    wrapper.innerHTML = `
                        <div class="widget custom-report-widget-group">
                            <div class="widget-head">
                                <div class="widget-title">${table_doc.report_name}</div>
                            </div>
                            <div class="widget-body">
                                ${table_html}
                            </div>
                        </div>
                    `;

                    grid.appendChild(wrapper);

                } catch (err) {
                    console.error("Failed processing table:", err);
                }
            }

        } catch (err) {
            console.error("Failed fetching Dashboard:", err);
        }

    }, 150);
}

function insert_table_after_onboarding(module_name, table_html, title) {

    const onboarding = document.querySelector(
        `div[onboarding_name="${module_name}"]`
    );
    if (!onboarding) return;

    const ce_block = onboarding.closest(".ce-block");
    if (!ce_block) return;

    let grid_block = document.querySelector(
        `.custom-report-grid-block[data-module="${module_name}"]`
    );

    // Kalau belum ada wrapper grid → buat sekali saja
    if (!grid_block) {
        grid_block = document.createElement("div");
        grid_block.className = "ce-block custom-report-grid-block";
        grid_block.dataset.module = module_name;

        grid_block.innerHTML = `
            <div class="ce-block__content">
                <div class="custom-report-grid"></div>
            </div>
        `;

        ce_block.parentNode.insertBefore(
            grid_block,
            ce_block.nextSibling
        );
    }

    const grid = grid_block.querySelector(".custom-report-grid");

    // 🔎 Cek apakah widget report ini sudah ada
    let existing_widget = grid.querySelector(
        `.custom-report-widget[data-report="${title}"]`
    );

    if (existing_widget) {
        // ✅ Kalau sudah ada → update body saja
        existing_widget.querySelector(".widget-body").innerHTML = table_html;
        return;
    }

    // 🆕 Kalau belum ada → buat baru
    const wrapper = document.createElement("div");
    wrapper.className = "custom-report-widget";
    wrapper.dataset.report = title;

    wrapper.innerHTML = `
        <div class="widget custom-report-widget-group">
            <div class="widget-head">
                <div class="widget-title">${title}</div>
            </div>
            <div class="widget-body">
                ${table_html}
            </div>
        </div>
    `;

    grid.appendChild(wrapper);
}