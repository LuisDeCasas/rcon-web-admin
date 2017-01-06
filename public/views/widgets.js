"use strict";
View.register("widgets", function (messageData) {
    var widgetTpl = $(".widget-row");
    var container = $(".widgets-installed");
    for (var widgetIndex in messageData.widgets) {
        if (messageData.widgets.hasOwnProperty(widgetIndex)) {
            var widgetRow = messageData.widgets[widgetIndex];
            var widgetEl = widgetTpl.clone().removeClass("hidden");
            var widget = new Widget(widgetIndex);
            widget.data = {
                "manifest": widgetRow
            };
            widgetEl.attr("data-id", widgetIndex);
            widgetEl.find("strong").text(widget.t("name") + " v" + widgetRow.version);
            widgetEl.find("a.github").attr("href", "https://github.com/" + widgetRow.repository);
            widgetEl.find("small").text(widget.t("description"));
            widgetEl.find(".games .text").text(widgetRow.compatibleGames == "all" ? "All" : widgetRow.compatibleGames.join(", "));
            for (var i = 0; i < messageData.defaultWidgets.length; i++) {
                var repository = messageData.defaultWidgets[i];
                if (repository.match(new RegExp("/" + widgetIndex, "i"))) {
                    container.find(".actions .delete").remove();
                    break;
                }
            }
            container.append(widgetEl);
        }
    }
    container.on("click", ".update", function () {
        var e = $(this).closest(".widget-row");
        var btn = $(this);
        var id = e.attr("data-id");
        Modal.confirm(t("widgets.update.confirm"), function (success) {
            if (success) {
                btn.remove();
                note(t("widgets.update.progress"), "info", 3000);
                Socket.send("view", {
                    "view": "widgets",
                    "action": "update",
                    "widget": id
                }, function (data) {
                    note(data.message, data.type, 10000);
                });
            }
        });
    });
});