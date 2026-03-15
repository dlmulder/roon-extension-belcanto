"use strict";

var BelCanto = require("node-belcanto"),
RoonApi = require("node-roon-api"),
RoonApiSettings = require('node-roon-api-settings'),
RoonApiStatus = require('node-roon-api-status'),
RoonApiVolumeControl = require('node-roon-api-volume-control'),
RoonApiSourceControl = require('node-roon-api-source-control');

var roon = new RoonApi({
    extension_id: 'com.dlmulder.roon.belcanto',
    display_name: 'BelCanto Volume/Source Control',
    display_version: "1.0.0",
    publisher: 'Dave Mulder',
    email: 'dlmulder@gmail.com',
    website: 'https://github.com/dlmulder/roon-extension-belcanto',
});

var mysettings = roon.load_config("settings") || {
    serialport: "",
    serialport2: "",
    baudrate: 9600,
    setsource: 1,
    initialvolume: 30,
    initialdisplay: 0,
    startuptime: 7
};

var belcanto = {};

function makelayout(settings) {
    var l = {
        values: settings,
        layout: [],
        has_error: false
    };

    l.layout.push({
        type: "string",
        title: "Serial Port",
        maxlength: 256,
        setting: "serialport",
    });
    l.layout.push({
        type: "string",
        title: "Serial Port 2 (optional)",
        maxlength: 256,
        setting: "serialport2",
    });

    l.layout.push({
        type: "integer",
        title: "Baud Rate",
        min: 0,
        setting: "baudrate",
    });

    l.layout.push({
        type: "integer",
        title: "Source for Convenience Switch",
        min: 1,
        max: 20,
        setting: "setsource",
    });

    l.layout.push({
        type: "integer",
        title: "Initial Volume",
        min: 0,
        max: 100,
        setting: "initialvolume",
    });

    l.layout.push({
        type: "dropdown",
        title: "Initial Display",
        values: [{title: "(select display mode)", value: undefined}, {title:"Normal", value: "on"}, {title: "Off", value: "off"}],
        setting: "initialdisplay",
    });

    l.layout.push({
        type: "integer",
        title: "Startup Time (s)",
        min: 0,
        max: 100,
        setting: "startuptime",
    });
    l.layout.push({
        type: "integer",
        title: "BelCanto USB Vendor ID (VID identifier)",
        setting: "usbVid",
    });
    return l;
}

var svc_settings = new RoonApiSettings(roon, {
    get_settings: function (cb) {
        cb(makelayout(mysettings));
    },
    save_settings: function (req, isdryrun, settings) {
        let l = makelayout(settings.values);
        req.send_complete(l.has_error ? "NotValid" : "Success", {
            settings: l
        });

        if (!isdryrun && !l.has_error) {
            var oldport = mysettings.serialport;
            var oldport2 = mysettings.serialport2;
            mysettings = l.values;
            svc_settings.update_settings(l);
            let force = false;
            if (oldport != mysettings.serialport)
                force = true;
            if (oldport2 != mysettings.serialport2)
                force = true;
            if (force)
                setup();
            roon.save_config("settings", mysettings);
        }
    }
});

var svc_status = new RoonApiStatus(roon);
var svc_volume_control = new RoonApiVolumeControl(roon);
var svc_source_control = new RoonApiSourceControl(roon);

roon.init_services({
    provided_services: [svc_volume_control, svc_source_control, svc_settings, svc_status]
});

function setup() {
    if (belcanto.control)
        belcanto.control.stop();

    belcanto.control = new BelCanto();

    belcanto.control.on('connected', ev_connected);
    belcanto.control.on('disconnected', ev_disconnected);
    belcanto.control.on('volume', ev_volume);
    belcanto.control.on('source', ev_source);

    if (belcanto.source_control) {
        belcanto.source_control.destroy();
        delete (belcanto.source_control);
    }
    if (belcanto.volume_control) {
        belcanto.volume_control.destroy();
        delete (belcanto.volume_control);
    }

    var opts = {
        volume: mysettings.initialvolume,
        source: mysettings.setsource,
        display: mysettings.initialdisplay
    };
    if (!mysettings.serialport) {
        svc_status.set_status("Not configured, please check settings.", true);
        return;
    }
    opts.port = mysettings.serialport;
    opts.baud = parseInt(mysettings.baudrate);
    console.log(opts);
    belcanto.control.start(opts);

    if(mysettings.serialport2) {
        var opts2 = {
            volume: mysettings.initialvolume,
            source: mysettings.setsource,
            display: mysettings.initialdisplay
        };
        opts2.port = mysettings.serialport2;
        opts.baud = parseInt(mysettings.baudrate);
        console.log(opts2);
        belcanto.control.start(opts2);
    }
}

function ev_connected(status) {
    let control = belcanto.control;

    console.log("[BelCanto Extension] Connected");

    svc_status.set_status("Connected to BelCanto", false);

    control.set_volume(mysettings.initialvolume);
    control.set_source(mysettings.setsource);
    control.set_display(mysettings.initialdisplay);

    belcanto.volume_control = svc_volume_control.new_device({
        state: {
            display_name: "BelCanto",
            volume_type: "number",
            volume_min: 0,
            volume_max: 100,
            volume_value: -1,
            volume_step: 1.0,
            is_muted: control.properties.source == "Muted"
        },
        set_volume: function (req, mode, value) {
            let newvol = mode == "absolute" ? value : (control.properties.volume + value);
            if (newvol < this.state.volume_min)
                newvol = this.state.volume_min;
            else if (newvol > this.state.volume_max)
                newvol = this.state.volume_max;
            control.set_volume(newvol);
            req.send_complete("Success");
        },
        set_mute: function (req, mode) {
            if (mode == "on")
                control.mute(1);
            else if (mode == "off")
                control.mute(0);
            req.send_complete("Success");
        },
    });

    belcanto.source_control = svc_source_control.new_device({
        state: {
            display_name: "BelCanto",
            supports_standby: false,
            status: "deselected"  // "standby" "selected" "deselected")
        },
        convenience_switch: function (req) {
            if (this.state.status == "standby") {
                control.power_on();
                control.set_source(mysettings.setsource);
                control.set_display(mysettings.initialdisplay);
                setTimeout(() => {
                    req.send_complete("Success");
                }, mysettings.startuptime * 1000);
                control.set_volume(mysettings.initialvolume);
            } else {
                control.set_source(mysettings.setsource);
                control.set_display(mysettings.initialdisplay);
                req.send_complete("Success");
            }
        },
        standby: function (req) {
            this.state.status = "standby";
            control.power_off();
            req.send_complete("Success");
        }
    });

}

function ev_disconnected(status) {
    let control = belcanto.control;

    console.log("[BelCanto Extension] Disconnected");

    svc_status.set_status("Could not connect to BelCanto on \"" + mysettings.serialport + "\"", true);

    if (belcanto.source_control) {
        belcanto.source_control.destroy();
        delete (belcanto.source_control);
    }
    if (belcanto.volume_control) {
        belcanto.volume_control.destroy();
        delete (belcanto.volume_control);
    }
}

function ev_volume(val) {
    console.log("[BelCanto Extension] received volume change from device:", val);
    if (belcanto.volume_control)
        belcanto.volume_control.update_state({
            volume_value: val
        });
}
function ev_source(val) {
    console.log("[BelCanto Extension] received source change from device:", val);
    if (val == "Muted" && belcanto.volume_control)
        belcanto.volume_control.update_state({
            is_muted: true
        });
    else if (val == "UnMuted" && belcanto.volume_control)
        belcanto.volume_control.update_state({
            is_muted: false
        });
    else if (val == "Standby" && belcanto.source_control)
        belcanto.source_control.update_state({
            status: "standby"
        });
    else {
        if (belcanto.volume_control)
            belcanto.volume_control.update_state({
                is_muted: false
            });
        belcanto.source_control.update_state({
            status: (val == mysettings.setsource ? "selected" : "deselected")
        });
    }
}

setup();

roon.start_discovery();
