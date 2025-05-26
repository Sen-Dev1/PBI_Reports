/**
 * jQuery CSS Customizable Scrollbar
 *
 * Copyright 2014, Yuriy Khabarov
 * Dual licensed under the MIT or GPL Version 2 licenses.
 *
 * If you found bug, please contact me via email <13real008@gmail.com>
 *
 * @author Yuriy Khabarov aka Gromo
 * @version 0.2.5
 * @url https://github.com/gromo/jquery.scrollbar/
 *
 */
;
(function ($, doc, win) {
    'use strict';

    // init flags & variables
    var debug = false;
    var lmb = 1, px = "px";

    var browser = {
        "data": {},
        "macosx": win.navigator.platform.toLowerCase().indexOf('mac') !== -1,
        "mobile": /Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(win.navigator.userAgent),
        "overlay": null,
        "scroll": null,
        "scrolls": [],
        "webkit": /WebKit/.test(win.navigator.userAgent),

        "log": debug ? function (data, toString) {
            var output = data;
            if (toString && typeof data != "string") {
                output = [];
                $.each(data, function (i, v) {
                    output.push('"' + i + '": ' + v);
                });
                output = output.join(", ");
            }
            if (win.console && win.console.log) {
                win.console.log(output);
            } else {
                alert(output);
            }
        } : function () {

        }
    };

    var defaults = {
        "autoScrollSize": true,     // automatically calculate scrollsize
        "autoUpdate": true,         // update scrollbar if content/container size changed
        "debug": false,             // debug mode
        "disableBodyScroll": false, // disable body scroll if mouse over container
        "duration": 200,            // scroll animate duration in ms
        "ignoreMobile": true,       // ignore mobile devices
        "ignoreOverlay": true,      // ignore browsers with overlay scrollbars (mobile, MacOS)
        "scrollStep": 30,           // scroll step for scrollbar arrows
        "showArrows": false,        // add class to show arrows
        "stepScrolling": true,      // when scrolling to scrollbar mousedown position
        "type": "simple",            // [advanced|simple] scrollbar html type

        "scrollx": null,            // horizontal scroll element
        "scrolly": null,            // vertical scroll element

        "onDestroy": null,          // callback function on destroy,
        "onInit": null,             // callback function on first initialization
        "onScroll": null,           // callback function on content scrolling
        "onUpdate": null            // callback function on init/resize (before scrollbar size calculation)
    };


    var customScrollbar = function (container, options) {

        if (!browser.scroll) {
            browser.log("Init jQuery Scrollbar v0.2.5");
            browser.overlay = isScrollOverlaysContent();
            browser.scroll = getBrowserScrollSize();
            updateScrollbars();

            $(win).resize(function () {
                var forceUpdate = false;
                if (browser.scroll && (browser.scroll.height || browser.scroll.width)) {
                    var scroll = getBrowserScrollSize();
                    if (scroll.height != browser.scroll.height || scroll.width != browser.scroll.width) {
                        browser.scroll = scroll;
                        forceUpdate = true; // handle page zoom
                    }
                }
                updateScrollbars(forceUpdate);
            });
        }

        this.container = container;
        this.options = $.extend({}, defaults, win.jQueryScrollbarOptions || {});
        this.scrollTo = null;
        this.scrollx = {};
        this.scrolly = {};

        this.init(options);
    };

    customScrollbar.prototype = {

        destroy: function () {

            if (!this.wrapper) {
                return;
            }

            // init variables
            var scrollLeft = this.container.scrollLeft();
            var scrollTop = this.container.scrollTop();

            this.container.insertBefore(this.wrapper).css({
                "height": "",
                "margin": ""
            })
            .removeClass("scroll-content")
            .removeClass("scroll-scrollx_visible")
            .removeClass("scroll-scrolly_visible")
            .off(".scrollbar")
            .scrollLeft(scrollLeft)
            .scrollTop(scrollTop);

            this.scrollx.scrollbar.removeClass("scroll-scrollx_visible").find("div").andSelf().off(".scrollbar");
            this.scrolly.scrollbar.removeClass("scroll-scrolly_visible").find("div").andSelf().off(".scrollbar");

            this.wrapper.remove();

            $(doc).add("body").off(".scrollbar");

            if ($.isFunction(this.options.onDestroy))
                this.options.onDestroy.apply(this, [this.container]);
        },



        getScrollbar: function (d) {

            var scrollbar = this.options["scroll" + d];
            var html = {
                "advanced":
                '<div class="scroll-element_corner"></div>' +
                '<div class="scroll-arrow scroll-arrow_less"></div>' +
                '<div class="scroll-arrow scroll-arrow_more"></div>' +
                '<div class="scroll-element_outer">' +
                '    <div class="scroll-element_size"></div>' + // required! used for scrollbar size calculation !
                '    <div class="scroll-element_inner-wrapper">' +
                '        <div class="scroll-element_inner scroll-element_track">' + // used for handling scrollbar click
                '            <div class="scroll-element_inner-bottom"></div>' +
                '        </div>' +
                '    </div>' +
                '    <div class="scroll-bar">' +
                '        <div class="scroll-bar_body">' +
                '            <div class="scroll-bar_body-inner"></div>' +
                '        </div>' +
                '        <div class="scroll-bar_bottom"></div>' +
                '        <div class="scroll-bar_center"></div>' +
                '    </div>' +
                '</div>',

                "simple":
                '<div class="scroll-element_outer">' +
                '    <div class="scroll-element_size"></div>' + // required! used for scrollbar size calculation !
                '    <div class="scroll-element_track"></div>' + // used for handling scrollbar click
                '    <div class="scroll-bar"></div>' +
                '</div>'
            };
            var type = html[this.options.type] ? this.options.type : "advanced";

            if (scrollbar) {
                if (typeof (scrollbar) == "string") {
                    scrollbar = $(scrollbar).appendTo(this.wrapper);
                } else {
                    scrollbar = $(scrollbar);
                }
            } else {
                scrollbar = $("<div>").addClass("scroll-element").html(html[type]).appendTo(this.wrapper);
            }

            if (this.options.showArrows) {
                scrollbar.addClass("scroll-element_arrows_visible");
            }

            return scrollbar.addClass("scroll-" + d);
        },



        init: function (options) {

            // init variables
            var S = this;

            var c = this.container;
            var cw = this.containerWrapper || c;
            var o = $.extend(this.options, options || {});
            var s = {
                "x": this.scrollx,
                "y": this.scrolly
            };
            var w = this.wrapper;

            var initScroll = {
                "scrollLeft": c.scrollLeft(),
                "scrollTop": c.scrollTop()
            };

            // do not init if in ignorable browser
            if ((browser.mobile && o.ignoreMobile)
                    || (browser.overlay && o.ignoreOverlay)
                    || (browser.macosx && !browser.webkit) // still required to ignore nonWebKit browsers on Mac
                    ) {
                return false;
            }

            // init scroll container
            if (!w) {
                this.wrapper = w = $('<div>').addClass('scroll-wrapper').addClass(c.attr('class'))
                .css('position', c.css('position') == 'absolute' ? 'absolute' : 'relative')
                .insertBefore(c).append(c);

                if (c.is('textarea')) {
                    this.containerWrapper = cw = $('<div>').insertBefore(c).append(c);
                    w.addClass('scroll-textarea');
                }

                cw.addClass("scroll-content").css({
                    "height": "",
                    "margin-bottom": browser.scroll.height * -1 + px,
                    "margin-right": browser.scroll.width * -1 + px
                });

                c.on("scroll.scrollbar", function (event) {
                    if ($.isFunction(o.onScroll)) {
                        o.onScroll.call(S, {
                            "maxScroll": s.y.maxScrollOffset,
                            "scroll": c.scrollTop(),
                            "size": s.y.size,
                            "visible": s.y.visible
                        }, {
                            "maxScroll": s.x.maxScrollOffset,
                            "scroll": c.scrollLeft(),
                            "size": s.x.size,
                            "visible": s.x.visible
                        });
                    }
                    s.x.isVisible && s.x.scroller.css("left", c.scrollLeft() * s.x.kx + px);
                    s.y.isVisible && s.y.scroller.css("top", c.scrollTop() * s.y.kx + px);
                });

                /* prevent native scrollbars to be visible on #anchor click */
                w.on("scroll", function () {
                    w.scrollTop(0).scrollLeft(0);
                });

                if (o.disableBodyScroll) {
                    var handleMouseScroll = function (event) {
                        isVerticalScroll(event) ?
                        s.y.isVisible && s.y.mousewheel(event) :
                        s.x.isVisible && s.x.mousewheel(event);
                    };
                    w.on({
                        "MozMousePixelScroll.scrollbar": handleMouseScroll,
                        "mousewheel.scrollbar": handleMouseScroll
                    });

                    if (browser.mobile) {
                        w.on("touchstart.scrollbar", function (event) {
                            var touch = event.originalEvent.touches && event.originalEvent.touches[0] || event;
                            var originalTouch = {
                                "pageX": touch.pageX,
                                "pageY": touch.pageY
                            };
                            var originalScroll = {
                                "left": c.scrollLeft(),
                                "top": c.scrollTop()
                            };
                            $(doc).on({
                                "touchmove.scrollbar": function (event) {
                                    var touch = event.originalEvent.targetTouches && event.originalEvent.targetTouches[0] || event;
                                    c.scrollLeft(originalScroll.left + originalTouch.pageX - touch.pageX);
                                    c.scrollTop(originalScroll.top + originalTouch.pageY - touch.pageY);
                                    event.preventDefault();
                                },
                                "touchend.scrollbar": function () {
                                    $(doc).off(".scrollbar");
                                }
                            });
                        });
                    }
                }
                if ($.isFunction(o.onInit))
                    o.onInit.apply(this, [c]);
            } else {
                cw.css({
                    "height": "",
                    "margin-bottom": browser.scroll.height * -1 + px,
                    "margin-right": browser.scroll.width * -1 + px
                });
            }

            // init scrollbars & recalculate sizes
            $.each(s, function (d, scrollx) {

                var scrollCallback = null;
                var scrollForward = 1;
                var scrollOffset = (d == "x") ? "scrollLeft" : "scrollTop";
                var scrollStep = o.scrollStep;
                var scrollTo = function () {
                    var currentOffset = c[scrollOffset]();
                    c[scrollOffset](currentOffset + scrollStep);
                    if (scrollForward == 1 && (currentOffset + scrollStep) >= scrollToValue)
                        currentOffset = c[scrollOffset]();
                    if (scrollForward == -1 && (currentOffset + scrollStep) <= scrollToValue)
                        currentOffset = c[scrollOffset]();
                    if (c[scrollOffset]() == currentOffset && scrollCallback) {
                        scrollCallback();
                    }
                }
                var scrollToValue = 0;

                if (!scrollx.scrollbar) {

                    scrollx.scrollbar = S.getScrollbar(d);
                    scrollx.scroller = scrollx.scrollbar.find(".scroll-bar");

                    scrollx.mousewheel = function (event) {

                        if (!scrollx.isVisible || (d == 'x' && isVerticalScroll(event))) {
                            return true;
                        }
                        if (d == 'y' && !isVerticalScroll(event)) {
                            s.x.mousewheel(event);
                            return true;
                        }

                        var delta = event.originalEvent.wheelDelta * -1 || event.originalEvent.detail;
                        var maxScrollValue = scrollx.size - scrollx.visible - scrollx.offset;

                        if (!((scrollToValue <= 0 && delta < 0) || (scrollToValue >= maxScrollValue && delta > 0))) {
                            scrollToValue = scrollToValue + delta;
                            if (scrollToValue < 0)
                                scrollToValue = 0;
                            if (scrollToValue > maxScrollValue)
                                scrollToValue = maxScrollValue;

                            S.scrollTo = S.scrollTo || {};
                            S.scrollTo[scrollOffset] = scrollToValue;
                            setTimeout(function () {
                                if (S.scrollTo) {
                                    c.stop().animate(S.scrollTo, 240, 'linear', function () {
                                        scrollToValue = c[scrollOffset]();
                                    });
                                    S.scrollTo = null;
                                }
                            }, 1);
                        }

                        event.preventDefault();
                        return false;
                    };

                    scrollx.scrollbar.on({
                        "MozMousePixelScroll.scrollbar": scrollx.mousewheel,
                        "mousewheel.scrollbar": scrollx.mousewheel,
                        "mouseenter.scrollbar": function () {
                            scrollToValue = c[scrollOffset]();
                        }
                    });

                    // handle arrows & scroll inner mousedown event
                    scrollx.scrollbar.find(".scroll-arrow, .scroll-element_track")
                    .on("mousedown.scrollbar", function (event) {

                        if (event.which != lmb)
                            return true;

                        scrollForward = 1;

                        var data = {
                            "eventOffset": event[(d == "x") ? "pageX" : "pageY"],
                            "maxScrollValue": scrollx.size - scrollx.visible - scrollx.offset,
                            "scrollbarOffset": scrollx.scroller.offset()[(d == "x") ? "left" : "top"],
                            "scrollbarSize": scrollx.scroller[(d == "x") ? "outerWidth" : "outerHeight"]()
                        };
                        var timeout = 0, timer = 0;

                        if ($(this).hasClass('scroll-arrow')) {
                            scrollForward = $(this).hasClass("scroll-arrow_more") ? 1 : -1;
                            scrollStep = o.scrollStep * scrollForward;
                            scrollToValue = scrollForward > 0 ? data.maxScrollValue : 0;
                        } else {
                            scrollForward = (data.eventOffset > (data.scrollbarOffset + data.scrollbarSize) ? 1
                                : (data.eventOffset < data.scrollbarOffset ? -1 : 0));
                            scrollStep = Math.round(scrollx.visible * 0.75) * scrollForward;
                            scrollToValue = (data.eventOffset - data.scrollbarOffset -
                                (o.stepScrolling ? (scrollForward == 1 ? data.scrollbarSize : 0)
                                    : Math.round(data.scrollbarSize / 2)));
                            scrollToValue = c[scrollOffset]() + (scrollToValue / scrollx.kx);
                        }

                        S.scrollTo = S.scrollTo || {};
                        S.scrollTo[scrollOffset] = o.stepScrolling ? c[scrollOffset]() + scrollStep : scrollToValue;

                        if (o.stepScrolling) {
                            scrollCallback = function () {
                                scrollToValue = c[scrollOffset]();
                                clearInterval(timer);
                                clearTimeout(timeout);
                                timeout = 0;
                                timer = 0;
                            };
                            timeout = setTimeout(function () {
                                timer = setInterval(scrollTo, 40);
                            }, o.duration + 100);
                        }

                        setTimeout(function () {
                            if (S.scrollTo) {
                                c.animate(S.scrollTo, o.duration);
                                S.scrollTo = null;
                            }
                        }, 1);

                        return handleMouseDown(scrollCallback, event);
                    });

                    // handle scrollbar drag'n'drop
                    scrollx.scroller.on("mousedown.scrollbar", function (event) {

                        if (event.which != lmb)
                            return true;

                        var eventPosition = event[(d == "x") ? "pageX" : "pageY"];
                        var initOffset = c[scrollOffset]();

                        scrollx.scrollbar.addClass("scroll-draggable");

                        $(doc).on("mousemove.scrollbar", function (event) {
                            var diff = parseInt((event[(d == "x") ? "pageX" : "pageY"] - eventPosition) / scrollx.kx, 10);
                            c[scrollOffset](initOffset + diff);
                        });

                        return handleMouseDown(function () {
                            scrollx.scrollbar.removeClass("scroll-draggable");
                            scrollToValue = c[scrollOffset]();
                        }, event);
                    });
                }
            });

            // remove classes & reset applied styles
            $.each(s, function (d, scrollx) {
                var scrollClass = "scroll-scroll" + d + "_visible";
                var scrolly = (d == "x") ? s.y : s.x;

                scrollx.scrollbar.removeClass(scrollClass);
                scrolly.scrollbar.removeClass(scrollClass);
                cw.removeClass(scrollClass);
            });

            // calculate init sizes
            $.each(s, function (d, scrollx) {
                $.extend(scrollx, (d == "x") ? {
                    "offset": parseInt(c.css("left"), 10) || 0,
                    "size": c.prop("scrollWidth"),
                    "visible": w.width()
                } : {
                    "offset": parseInt(c.css("top"), 10) || 0,
                    "size": c.prop("scrollHeight"),
                    "visible": w.height()
                });
            });


            var updateScroll = function (d, scrollx) {

                var scrollClass = "scroll-scroll" + d + "_visible";
                var scrolly = (d == "x") ? s.y : s.x;
                var offset = parseInt(c.css((d == "x") ? "left" : "top"), 10) || 0;

                var AreaSize = scrollx.size;
                var AreaVisible = scrollx.visible + offset;

                scrollx.isVisible = (AreaSize - AreaVisible) > 1; // bug in IE9/11 with 1px diff
                if (scrollx.isVisible) {
                    scrollx.scrollbar.addClass(scrollClass);
                    scrolly.scrollbar.addClass(scrollClass);
                    cw.addClass(scrollClass);
                } else {
                    scrollx.scrollbar.removeClass(scrollClass);
                    scrolly.scrollbar.removeClass(scrollClass);
                    cw.removeClass(scrollClass);
                }

                if (d == "y" && (scrollx.isVisible || scrollx.size < scrollx.visible)) {
                    cw.css("height", (AreaVisible + browser.scroll.height) + px);
                }

                if (s.x.size != c.prop("scrollWidth")
                    || s.y.size != c.prop("scrollHeight")
                    || s.x.visible != w.width()
                    || s.y.visible != w.height()
                    || s.x.offset != (parseInt(c.css("left"), 10) || 0)
                    || s.y.offset != (parseInt(c.css("top"), 10) || 0)
                    ) {
                    $.each(s, function (d, scrollx) {
                        $.extend(scrollx, (d == "x") ? {
                            "offset": parseInt(c.css("left"), 10) || 0,
                            "size": c.prop("scrollWidth"),
                            "visible": w.width()
                        } : {
                            "offset": parseInt(c.css("top"), 10) || 0,
                            "size": c.prop("scrollHeight"),
                            "visible": w.height()
                        });
                    });
                    updateScroll(d == "x" ? "y" : "x", scrolly);
                }
            };
            $.each(s, updateScroll);

            if ($.isFunction(o.onUpdate))
                o.onUpdate.apply(this, [c]);

            // calculate scroll size
            $.each(s, function (d, scrollx) {

                var cssOffset = (d == "x") ? "left" : "top";
                var cssFullSize = (d == "x") ? "outerWidth" : "outerHeight";
                var cssSize = (d == "x") ? "width" : "height";
                var offset = parseInt(c.css(cssOffset), 10) || 0;

                var AreaSize = scrollx.size;
                var AreaVisible = scrollx.visible + offset;

                var scrollSize = scrollx.scrollbar.find(".scroll-element_size");
                scrollSize = scrollSize[cssFullSize]() + (parseInt(scrollSize.css(cssOffset), 10) || 0);

                if (o.autoScrollSize) {
                    scrollx.scrollbarSize = parseInt(scrollSize * AreaVisible / AreaSize, 10);
                    scrollx.scroller.css(cssSize, scrollx.scrollbarSize + px);
                }

                scrollx.scrollbarSize = scrollx.scroller[cssFullSize]();
                scrollx.kx = ((scrollSize - scrollx.scrollbarSize) / (AreaSize - AreaVisible)) || 1;
                scrollx.maxScrollOffset = AreaSize - AreaVisible;
            });

            c.scrollLeft(initScroll.scrollLeft).scrollTop(initScroll.scrollTop).trigger("scroll");
        }
    };

    /*
     * Extend jQuery as plugin
     *
     * @param {object|string} options or command to execute
     * @param {object|array} args additional arguments as array []
     */
    $.fn.scrollbar = function (options, args) {

        var toReturn = this;

        if (options === "get")
            toReturn = null;

        this.each(function () {

            var container = $(this);

            if (container.hasClass("scroll-wrapper")
                || container.get(0).nodeName == "body") {
                return true;
            }

            var instance = container.data("scrollbar");
            if (instance) {
                if (options === "get") {
                    toReturn = instance;
                    return false;
                }

                var func = (typeof options == "string" && instance[options]) ? options : "init";
                instance[func].apply(instance, $.isArray(args) ? args : []);

                if (options === "destroy") {
                    container.removeData("scrollbar");
                    while ($.inArray(instance, browser.scrolls) >= 0)
                        browser.scrolls.splice($.inArray(instance, browser.scrolls), 1);
                }
            } else {
                if (typeof options != "string") {
                    instance = new customScrollbar(container, options);
                    container.data("scrollbar", instance);
                    browser.scrolls.push(instance);
                }
            }
            return true;
        });

        return toReturn;
    };

    /**
     * Connect default options to global object
     */
    $.fn.scrollbar.options = defaults;

    /**
     * Extend AngularJS as UI directive
     *
     *
     */
    if (win.angular) {
        (function (angular) {
            var app = angular.module('jQueryScrollbar', []);
            app.directive('jqueryScrollbar', function () {
                return {
                    "link": function (scope, element) {
                        element.scrollbar(scope.options).on('$destroy', function () {
                            element.scrollbar('destroy');
                        });
                    },
                    "restring": "AC",
                    "scope": {
                        "options": "=jqueryScrollbar"
                    }
                };
            });
        })(win.angular);
    }

    /**
     * Check if scroll content/container size is changed
     */
    var timer = 0, timerCounter = 0;
    var updateScrollbars = function (force) {
        var i, c, o, s, w, x, y;
        for (i = 0; i < browser.scrolls.length; i++) {
            s = browser.scrolls[i];
            c = s.container;
            o = s.options;
            w = s.wrapper;
            x = s.scrollx;
            y = s.scrolly;
            if (force || (o.autoUpdate && w && w.is(":visible") &&
                (c.prop("scrollWidth") != x.size
                    || c.prop("scrollHeight") != y.size
                    || w.width() != x.visible
                    || w.height() != y.visible
                    ))) {
                s.init();

                if (debug) {
                    browser.log({
                        "scrollHeight": c.prop("scrollHeight") + ":" + s.scrolly.size,
                        "scrollWidth": c.prop("scrollWidth") + ":" + s.scrollx.size,
                        "visibleHeight": w.height() + ":" + s.scrolly.visible,
                        "visibleWidth": w.width() + ":" + s.scrollx.visible
                    }, true);
                    timerCounter++;
                }
            }
        }
        if (debug && timerCounter > 10) {
            browser.log("Scroll updates exceed 10");
            updateScrollbars = function () { };
        } else {
            clearTimeout(timer);
            timer = setTimeout(updateScrollbars, 300);
        }
    };

    /* ADDITIONAL FUNCTIONS */
    /**
     * Get native browser scrollbar size (height/width)
     *
     * @param {Boolean} actual size or CSS size, default - CSS size
     * @returns {Object} with height, width
     */
    function getBrowserScrollSize(actualSize) {

        if (browser.webkit && !actualSize) {
            return {
                "height": 0,
                "width": 0
            };
        }

        if (!browser.data.outer) {
            var css = {
                "border": "none",
                "box-sizing": "content-box",
                "height": "200px",
                "margin": "0",
                "padding": "0",
                "width": "200px"
            };
            browser.data.inner = $("<div>").css($.extend({}, css));
            browser.data.outer = $("<div>").css($.extend({
                "left": "-1000px",
                "overflow": "scroll",
                "position": "absolute",
                "top": "-1000px"
            }, css)).append(browser.data.inner).appendTo("body");
        }

        browser.data.outer.scrollLeft(1000).scrollTop(1000);

        return {
            "height": Math.ceil((browser.data.outer.offset().top - browser.data.inner.offset().top) || 0),
            "width": Math.ceil((browser.data.outer.offset().left - browser.data.inner.offset().left) || 0)
        };
    }

    function handleMouseDown(callback, event) {
        $(doc).on({
            "blur.scrollbar": function () {
                $(doc).add('body').off('.scrollbar');
                callback && callback();
            },
            "dragstart.scrollbar": function (event) {
                event.preventDefault();
                return false;
            },
            "mouseup.scrollbar": function () {
                $(doc).add('body').off('.scrollbar');
                callback && callback();
            }
        });
        $("body").on({
            "selectstart.scrollbar": function (event) {
                event.preventDefault();
                return false;
            }
        });
        event && event.preventDefault();
        return false;
    }

    /**
     * Check if native browser scrollbars overlay content
     *
     * @returns {Boolean}
     */
    function isScrollOverlaysContent() {
        var scrollSize = getBrowserScrollSize(true);
        return !(scrollSize.height || scrollSize.width);
    }

    function isVerticalScroll(event) {
        var e = event.originalEvent;
        if (e.axis && e.axis === e.HORIZONTAL_AXIS)
            return false;
        if (e.wheelDeltaX)
            return false;
        return true;
    }

})(jQuery, document, window);

var powerbi;
(function (powerbi) {
    var visuals;
    (function (visuals) {
        var HierarchySlicer1458836712039;
        (function (HierarchySlicer1458836712039) {
            var SelectionManager = visuals.utility.SelectionManager;
            var createClassAndSelector = jsCommon.CssConstants.createClassAndSelector;
            var PixelConverter = jsCommon.PixelConverter;
            var TreeViewFactory;
            (function (TreeViewFactory) {
                function createListView(options) {
                    return new TreeView(options);
                }
                TreeViewFactory.createListView = createListView;
            })(TreeViewFactory = HierarchySlicer1458836712039.TreeViewFactory || (HierarchySlicer1458836712039.TreeViewFactory = {}));
            /**
             * A UI Virtualized List, that uses the D3 Enter, Update & Exit pattern to update rows.
             * It can create lists containing either HTML or SVG elements.
             */
            var TreeView = (function () {
                function TreeView(options) {
                    var _this = this;
                    // make a copy of options so that it is not modified later by caller
                    this.options = $.extend(true, {}, options);
                    this.scrollbarInner = options.baseContainer.append('div').classed('scrollbar-inner', true).on('scroll', function () { return _this.renderImpl(_this.options.rowHeight); });
                    this.scrollContainer = this.scrollbarInner.append('div').classed('scrollRegion', true);
                    this.visibleGroupContainer = this.scrollContainer.append('div').classed('visibleGroup', true);
                    var scrollInner = $(this.scrollbarInner.node());
                    scrollInner.scrollbar({
                        ignoreOverlay: false,
                        ignoreMobile: false,
                        onDestroy: function () {
                            return scrollInner.off('scroll');
                        },
                    });
                    $(options.baseContainer.node()).find('.scroll-element').attr('drag-resize-disabled', 'true');
                    TreeView.SetDefaultOptions(options);
                }
                TreeView.SetDefaultOptions = function (options) {
                    options.rowHeight = options.rowHeight || TreeView.defaultRowHeight;
                };
                TreeView.prototype.rowHeight = function (rowHeight) {
                    this.options.rowHeight = Math.ceil(rowHeight) + 2; // Margin top/bottom
                    return this;
                };
                TreeView.prototype.data = function (data, getDatumIndex, dataReset) {
                    if (dataReset === void 0) { dataReset = false; }
                    this._data = data;
                    this.getDatumIndex = getDatumIndex;
                    this.setTotalRows();
                    if (dataReset)
                        $(this.scrollbarInner.node()).scrollTop(0);
                    this.render();
                    return this;
                };
                TreeView.prototype.viewport = function (viewport) {
                    this.options.viewport = viewport;
                    this.render();
                    return this;
                };
                TreeView.prototype.empty = function () {
                    this._data = [];
                    this.render();
                };
                TreeView.prototype.render = function () {
                    var _this = this;
                    if (this.renderTimeoutId)
                        window.clearTimeout(this.renderTimeoutId);
                    this.renderTimeoutId = window.setTimeout(function () {
                        _this.renderImpl(_this.options.rowHeight);
                        _this.renderTimeoutId = undefined;
                    }, 0);
                };
                TreeView.prototype.renderImpl = function (rowHeight) {
                    var totalHeight = this.options.scrollEnabled ? Math.max(0, (this._totalRows * rowHeight)) : this.options.viewport.height;
                    this.scrollContainer.style('height', totalHeight + "px").attr('height', totalHeight);
                    this.scrollToFrame(true);
                };
                TreeView.prototype.scrollToFrame = function (loadMoreData) {
                    var options = this.options;
                    var visibleGroupContainer = this.visibleGroupContainer;
                    var totalRows = this._totalRows;
                    var rowHeight = options.rowHeight || TreeView.defaultRowHeight;
                    var visibleRows = this.getVisibleRows() || 1;
                    var scrollTop = this.scrollbarInner.node().scrollTop;
                    var scrollPosition = (scrollTop === 0) ? 0 : Math.floor(scrollTop / rowHeight);
                    var transformAttr = visuals.SVGUtil.translateWithPixels(0, scrollPosition * rowHeight);
                    visibleGroupContainer.style({
                        //order matters for proper overriding
                        'transform': function (d) { return transformAttr; },
                        '-webkit-transform': transformAttr
                    });
                    var position0 = Math.max(0, Math.min(scrollPosition, totalRows - visibleRows + 1)), position1 = position0 + visibleRows;
                    if (this.options.scrollEnabled) {
                        // Subtract the amount of height of the top row that's hidden when it's partially visible.
                        var topRowHiddenHeight = scrollTop - (scrollPosition * rowHeight);
                        var halfRowHeight = rowHeight * 0.5;
                        // If more than half the top row is hidden, we'll need to render an extra item at the bottom
                        if (topRowHiddenHeight > halfRowHeight) {
                            position1++; // Add 1 to handle when rows are partially visible (when scrolling)
                        }
                    }
                    var rowSelection = visibleGroupContainer.selectAll(".row").data(this._data.slice(position0, Math.min(position1, totalRows)), this.getDatumIndex);
                    rowSelection.enter().append('div').classed('row', true).call(function (d) { return options.enter(d); });
                    rowSelection.order();
                    var rowUpdateSelection = visibleGroupContainer.selectAll('.row:not(.transitioning)');
                    rowUpdateSelection.call(function (d) { return options.update(d); });
                    rowSelection.exit().call(function (d) { return options.exit(d); }).remove();
                    if (loadMoreData && visibleRows !== totalRows && position1 >= totalRows * TreeView.loadMoreDataThreshold)
                        options.loadMoreData();
                };
                TreeView.prototype.setTotalRows = function () {
                    var data = this._data;
                    this._totalRows = data ? data.length : 0;
                };
                TreeView.prototype.getVisibleRows = function () {
                    var minimumVisibleRows = 1;
                    var rowHeight = this.options.rowHeight;
                    var viewportHeight = this.options.viewport.height;
                    if (!rowHeight || rowHeight < 1)
                        return minimumVisibleRows;
                    if (this.options.scrollEnabled)
                        return Math.min(Math.ceil(viewportHeight / rowHeight), this._totalRows) || minimumVisibleRows;
                    return Math.min(Math.floor(viewportHeight / rowHeight), this._totalRows) || minimumVisibleRows;
                };
                /**
                 * The value indicates the percentage of data already shown
                 * in the list view that triggers a loadMoreData call.
                 */
                TreeView.loadMoreDataThreshold = 0.8;
                TreeView.defaultRowHeight = 1;
                return TreeView;
            })();
            var HierarchySlicerWebBehavior = (function () {
                function HierarchySlicerWebBehavior() {
                    this.initFilter = false;
                }
                HierarchySlicerWebBehavior.prototype.HierarchySlicerWebBehavior = function () {
                    this.initFilter = true;
                };
                HierarchySlicerWebBehavior.prototype.bindEvents = function (options, selectionHandler) {
                    var _this = this;
                    var expanders = this.expanders = options.expanders;
                    var slicers = this.slicers = options.slicerItemContainers;
                    this.slicerItemLabels = options.slicerItemLabels;
                    this.slicerItemInputs = options.slicerItemInputs;
                    this.dataPoints = options.dataPoints;
                    this.interactivityService = options.interactivityService;
                    this.selectionHandler = selectionHandler;
                    this.settings = options.slicerSettings;
                    this.hostServices = options.hostServices;
                    this.levels = options.levels;
                    this.options = options;
                    var slicerClear = options.slicerClear;
                    var slicerExpand = options.slicerExpand;
                    var slicerCollapse = options.slicerCollapse;
                    if ((this.dataPoints.filter(function (d) { return d.selected; }).length > 0) && this.initFilter) {
                        this.initFilter = false;
                        this.applyFilter();
                    }
                    expanders.on("click", function (d, i) {
                        d.isExpand = !d.isExpand;
                        var currentExpander = expanders.filter(function (e, l) { return i === l; });
                        currentExpander[0][0].firstChild.remove(); // remove expand/collapse icon
                        var spinner = currentExpander.append("div").classed("xsmall", true).classed("powerbi-spinner", true).style({
                            'margin': '0px;',
                            'padding-left': '5px;',
                            'display': 'block;',
                        }).attr("ng-if", "viewModel.showProgressBar").attr("delay", "500").append("div").classed("spinner", true);
                        for (var i = 0; i < 5; i++) {
                            spinner.append("div").classed("circle", true);
                        }
                        _this.persistExpand(false);
                    });
                    slicerCollapse.on("click", function (d) {
                        _this.dataPoints.filter(function (d) { return !d.isLeaf; }).forEach(function (d) { return d.isExpand = false; });
                        _this.persistExpand(true);
                    });
                    slicerExpand.on("click", function (d) {
                        _this.dataPoints.filter(function (d) { return !d.isLeaf; }).forEach(function (d) { return d.isExpand = true; });
                        _this.persistExpand(true);
                    });
                    options.slicerContainer.classed('hasSelection', true);
                    slicers.on("mouseover", function (d) {
                        if (d.selectable) {
                            d.mouseOver = true;
                            d.mouseOut = false;
                            _this.renderMouseover();
                        }
                    });
                    slicers.on("mouseout", function (d) {
                        if (d.selectable) {
                            d.mouseOver = false;
                            d.mouseOut = true;
                            _this.renderMouseover();
                        }
                    });
                    slicers.on("click", function (d, index) {
                        if (!d.selectable) {
                            return;
                        }
                        var settings = _this.settings;
                        d3.event.preventDefault();
                        if (!settings.general.singleselect) {
                            var selected = d.selected;
                            d.selected = !selected; // Toggle selection
                            if (!selected || !d.isLeaf) {
                                var selectDataPoints = _this.dataPoints.filter(function (dp) { return dp.parentId.indexOf(d.ownId) >= 0; });
                                for (var i = 0; i < selectDataPoints.length; i++) {
                                    if (selected === selectDataPoints[i].selected) {
                                        selectDataPoints[i].selected = !selected;
                                    }
                                }
                                selectDataPoints = _this.getParentDataPoints(_this.dataPoints, d.parentId);
                                for (var i = 0; i < selectDataPoints.length; i++) {
                                    if (!selected && !selectDataPoints[i].selected) {
                                        selectDataPoints[i].selected = !selected;
                                    }
                                    else if (selected && (_this.dataPoints.filter(function (dp) { return dp.selected && dp.level === d.level && dp.parentId === d.parentId; }).length === 0)) {
                                        selectDataPoints[i].selected = !selected;
                                    }
                                }
                            }
                            if (d.isLeaf) {
                                if (_this.dataPoints.filter(function (d) { return d.selected && d.isLeaf; }).length === 0) {
                                    _this.dataPoints.map(function (d) { return d.selected = false; }); // Clear selection
                                }
                            }
                        }
                        else {
                            var selected = d.selected;
                            _this.dataPoints.map(function (d) { return d.selected = false; }); // Clear selection
                            if (!selected) {
                                var selectDataPoints = [d]; //Self
                                selectDataPoints = selectDataPoints.concat(_this.dataPoints.filter(function (dp) { return dp.parentId.indexOf(d.ownId) >= 0; })); // Children
                                selectDataPoints = selectDataPoints.concat(_this.getParentDataPoints(_this.dataPoints, d.parentId)); // Parents
                                if (selectDataPoints) {
                                    for (var i = 0; i < selectDataPoints.length; i++) {
                                        selectDataPoints[i].selected = true;
                                    }
                                }
                            }
                        }
                        _this.applyFilter();
                    });
                    slicerClear.on("click", function (d) {
                        _this.selectionHandler.handleClearSelection();
                        _this.persistFilter(null);
                    });
                };
                HierarchySlicerWebBehavior.prototype.renderMouseover = function () {
                    var _this = this;
                    this.slicerItemLabels.style({
                        'color': function (d) {
                            if (d.mouseOver)
                                return _this.settings.slicerText.hoverColor;
                            else if (d.mouseOut) {
                                if (d.selected)
                                    return _this.settings.slicerText.fontColor;
                                else
                                    return _this.settings.slicerText.fontColor;
                            }
                            else
                                return _this.settings.slicerText.fontColor; //fallback
                        }
                    });
                };
                HierarchySlicerWebBehavior.prototype.renderSelection = function (hasSelection) {
                    if (!hasSelection && !this.interactivityService.isSelectionModeInverted()) {
                        this.slicerItemInputs.filter('.selected').classed('selected', false);
                        this.slicerItemInputs.filter('.partiallySelected').classed('partiallySelected', false);
                        var input = this.slicerItemInputs.selectAll('input');
                        if (input) {
                            input.property('checked', false);
                        }
                    }
                    else {
                        this.styleSlicerInputs(this.slicers, hasSelection);
                    }
                };
                HierarchySlicerWebBehavior.prototype.styleSlicerInputs = function (slicers, hasSelection) {
                    slicers.each(function (d) {
                        var slicerItem = this.getElementsByTagName('div')[0];
                        var shouldCheck = d.selected;
                        var partialCheck = false;
                        var input = slicerItem.getElementsByTagName('input')[0];
                        if (input)
                            input.checked = shouldCheck;
                        if (shouldCheck && partialCheck)
                            slicerItem.classList.add('partiallySelected');
                        else if (shouldCheck && (!partialCheck))
                            slicerItem.classList.add('selected');
                        else
                            slicerItem.classList.remove('selected');
                    });
                };
                HierarchySlicerWebBehavior.prototype.applyFilter = function () {
                    if (this.dataPoints.length === 0) {
                        return;
                    }
                    var selectNrValues = 0;
                    var filter;
                    var rootLevels = this.dataPoints.filter(function (d) { return d.level === 0 && d.selected; });
                    if (!rootLevels || (rootLevels.length === 0)) {
                        this.selectionHandler.handleClearSelection();
                        this.persistFilter(null);
                    }
                    else {
                        selectNrValues++;
                        var children = this.getChildFilters(this.dataPoints, rootLevels[0].ownId, 1);
                        var rootFilters = [];
                        if (children) {
                            rootFilters.push(powerbi.data.SQExprBuilder.and(rootLevels[0].id, children.filters));
                            selectNrValues += children.memberCount;
                        }
                        else {
                            rootFilters.push(rootLevels[0].id);
                        }
                        if (rootLevels.length > 1) {
                            for (var i = 1; i < rootLevels.length; i++) {
                                selectNrValues++;
                                children = this.getChildFilters(this.dataPoints, rootLevels[i].ownId, 1);
                                if (children) {
                                    rootFilters.push(powerbi.data.SQExprBuilder.and(rootLevels[i].id, children.filters));
                                    selectNrValues += children.memberCount;
                                }
                                else {
                                    rootFilters.push(rootLevels[i].id);
                                }
                            }
                        }
                        var rootFilter = rootFilters[0];
                        for (var i = 1; i < rootFilters.length; i++) {
                            rootFilter = powerbi.data.SQExprBuilder.or(rootFilter, rootFilters[i]);
                        }
                        if (selectNrValues > 120) {
                        }
                        filter = powerbi.data.SemanticFilter.fromSQExpr(rootFilter);
                        this.persistFilter(filter);
                    }
                };
                HierarchySlicerWebBehavior.prototype.getParentDataPoints = function (dataPoints, parentId) {
                    var parent = dataPoints.filter(function (d) { return d.ownId === parentId; });
                    if (!parent || (parent.length === 0)) {
                        return [];
                    }
                    else if (parent[0].level === 0) {
                        return parent;
                    }
                    else {
                        var returnParents = [];
                        returnParents = returnParents.concat(parent, this.getParentDataPoints(dataPoints, parent[0].parentId));
                        return returnParents;
                    }
                };
                HierarchySlicerWebBehavior.prototype.getChildFilters = function (dataPoints, parentId, level) {
                    var memberCount = 0;
                    var childFilters = dataPoints.filter(function (d) { return d.level === level && d.parentId === parentId && d.selected; });
                    var totalChildren = dataPoints.filter(function (d) { return d.level === level && d.parentId === parentId; }).length;
                    if (!childFilters || (childFilters.length === 0)) {
                        return;
                    }
                    else if (childFilters[0].isLeaf) {
                        if (totalChildren !== childFilters.length) {
                            var returnFilter = childFilters[0].id;
                            memberCount += childFilters.length;
                            if (childFilters.length > 1) {
                                for (var i = 1; i < childFilters.length; i++) {
                                    returnFilter = powerbi.data.SQExprBuilder.or(returnFilter, childFilters[i].id);
                                }
                            }
                            return {
                                filters: returnFilter,
                                memberCount: memberCount,
                            };
                        }
                        else {
                            return;
                        }
                    }
                    else {
                        var returnFilter;
                        var allSelected = (totalChildren === childFilters.length);
                        memberCount += childFilters.length;
                        for (var i = 0; i < childFilters.length; i++) {
                            var childChildFilter = this.getChildFilters(dataPoints, childFilters[i].ownId, level + 1);
                            if (childChildFilter) {
                                allSelected = false;
                                memberCount += childChildFilter.memberCount;
                                if (returnFilter) {
                                    returnFilter = powerbi.data.SQExprBuilder.or(returnFilter, powerbi.data.SQExprBuilder.and(childFilters[i].id, childChildFilter.filters));
                                }
                                else {
                                    returnFilter = powerbi.data.SQExprBuilder.and(childFilters[i].id, childChildFilter.filters);
                                }
                            }
                            else {
                                if (returnFilter) {
                                    returnFilter = powerbi.data.SQExprBuilder.or(returnFilter, childFilters[i].id);
                                }
                                else {
                                    returnFilter = childFilters[i].id;
                                }
                            }
                        }
                        return allSelected ? undefined : {
                            filters: returnFilter,
                            memberCount: memberCount,
                        };
                    }
                };
                HierarchySlicerWebBehavior.prototype.persistFilter = function (filter) {
                    var properties = {};
                    if (filter) {
                        properties[HierarchySlicer1458836712039.hierarchySlicerProperties.filterPropertyIdentifier.propertyName] = filter;
                    }
                    else {
                        properties[HierarchySlicer1458836712039.hierarchySlicerProperties.filterPropertyIdentifier.propertyName] = "";
                    }
                    var filterValues = this.dataPoints.filter(function (d) { return d.selected; }).map(function (d) { return d.ownId; }).join(',');
                    if (filterValues) {
                        properties[HierarchySlicer1458836712039.hierarchySlicerProperties.filterValuePropertyIdentifier.propertyName] = filterValues;
                    }
                    else {
                        properties[HierarchySlicer1458836712039.hierarchySlicerProperties.filterValuePropertyIdentifier.propertyName] = "";
                    }
                    var objects = {
                        merge: [
                            {
                                objectName: HierarchySlicer1458836712039.hierarchySlicerProperties.filterPropertyIdentifier.objectName,
                                selector: undefined,
                                properties: properties,
                            }
                        ]
                    };
                    this.hostServices.persistProperties(objects);
                    this.hostServices.onSelect({ data: [] });
                };
                HierarchySlicerWebBehavior.prototype.persistExpand = function (updateScrollbar) {
                    var properties = {};
                    properties[HierarchySlicer1458836712039.hierarchySlicerProperties.expandedValuePropertyIdentifier.propertyName] = this.dataPoints.filter(function (d) { return d.isExpand; }).map(function (d) { return d.ownId; }).join(',');
                    var objects = {
                        merge: [
                            {
                                objectName: HierarchySlicer1458836712039.hierarchySlicerProperties.expandedValuePropertyIdentifier.objectName,
                                selector: undefined,
                                properties: properties,
                            }
                        ]
                    };
                    this.hostServices.persistProperties(objects);
                    this.hostServices.onSelect({ data: [] });
                };
                return HierarchySlicerWebBehavior;
            })();
            HierarchySlicer1458836712039.HierarchySlicerWebBehavior = HierarchySlicerWebBehavior;
            HierarchySlicer1458836712039.hierarchySlicerProperties = {
                selection: {
                    singleselect: { objectName: 'selection', propertyName: 'singleSelect' },
                },
                header: {
                    show: { objectName: 'header', propertyName: 'show' },
                    title: { objectName: 'header', propertyName: 'title' },
                    fontColor: { objectName: 'header', propertyName: 'fontColor' },
                    background: { objectName: 'header', propertyName: 'background' },
                    textSize: { objectName: 'header', propertyName: 'textSize' },
                },
                items: {
                    fontColor: { objectName: 'items', propertyName: 'fontColor' },
                    background: { objectName: 'items', propertyName: 'background' },
                    textSize: { objectName: 'items', propertyName: 'textSize' },
                },
                selectedPropertyIdentifier: { objectName: 'general', propertyName: 'selected' },
                expandedValuePropertyIdentifier: { objectName: 'general', propertyName: 'expanded' },
                filterPropertyIdentifier: { objectName: 'general', propertyName: 'filter' },
                filterValuePropertyIdentifier: { objectName: 'general', propertyName: 'filterValues' },
                defaultValue: { objectName: 'general', propertyName: 'defaultValue' },
            };
            var HierarchySlicer = (function () {
                function HierarchySlicer(options) {
                    if (options) {
                        if (options.margin) {
                            this.margin = options.margin;
                        }
                        if (options.behavior) {
                            this.behavior = options.behavior;
                        }
                    }
                    if (!this.behavior) {
                        this.behavior = new HierarchySlicerWebBehavior();
                    }
                }
                HierarchySlicer.DefaultSlicerSettings = function () {
                    return {
                        general: {
                            rows: 0,
                            singleselect: true,
                            showDisabled: "",
                            outlineColor: '#808080',
                            outlineWeight: 1,
                        },
                        margin: {
                            top: 50,
                            bottom: 50,
                            right: 50,
                            left: 50
                        },
                        header: {
                            borderBottomWidth: 1,
                            show: true,
                            outline: 'BottomOnly',
                            fontColor: '#666666',
                            background: undefined,
                            textSize: 10,
                            outlineColor: '#a6a6a6',
                            outlineWeight: 1,
                            title: '',
                        },
                        headerText: {
                            marginLeft: 8,
                            marginTop: 0
                        },
                        slicerText: {
                            textSize: 10,
                            height: 18,
                            width: 0,
                            fontColor: '#666666',
                            hoverColor: '#212121',
                            selectedColor: '#BDD7EE',
                            unselectedColor: '#ffffff',
                            disabledColor: 'grey',
                            marginLeft: 8,
                            outline: 'Frame',
                            background: undefined,
                            transparency: 0,
                            outlineColor: '#000000',
                            outlineWeight: 1,
                            borderStyle: 'Cut',
                        },
                        slicerItemContainer: {
                            // The margin is assigned in the less file. This is needed for the height calculations.
                            marginTop: 5,
                            marginLeft: 0,
                        },
                    };
                };
                HierarchySlicer.prototype.converter = function (dataView) {
                    if (!dataView || !dataView.table || !dataView.table.rows || !(dataView.table.rows.length > 0) || !dataView.table.columns || !(dataView.table.columns.length > 0)) {
                        return {
                            dataPoints: [],
                            settings: null,
                            levels: null,
                        };
                    }
                    var rows = dataView.table.rows;
                    var columns = dataView.table.columns;
                    var levels = rows[0].length - 1;
                    var dataPoints = [];
                    var defaultSettings = HierarchySlicer.DefaultSlicerSettings();
                    var identityValues = [];
                    var selectedIds = [];
                    var expandedIds = [];
                    var selectionFilter;
                    var objects = dataView.metadata.objects;
                    defaultSettings.general.singleselect = powerbi.DataViewObjects.getValue(objects, HierarchySlicer1458836712039.hierarchySlicerProperties.selection.singleselect, defaultSettings.general.singleselect);
                    defaultSettings.header.title = powerbi.DataViewObjects.getValue(objects, HierarchySlicer1458836712039.hierarchySlicerProperties.header.title, dataView.metadata.columns[0].displayName);
                    selectedIds = powerbi.DataViewObjects.getValue(objects, HierarchySlicer1458836712039.hierarchySlicerProperties.filterValuePropertyIdentifier, "").split(',');
                    expandedIds = powerbi.DataViewObjects.getValue(objects, HierarchySlicer1458836712039.hierarchySlicerProperties.expandedValuePropertyIdentifier, "").split(',');
                    for (var r = 0; r < rows.length; r++) {
                        var parentExpr = null;
                        var parentId = '';
                        for (var c = 0; c < rows[r].length; c++) {
                            var format = dataView.table.columns[c].format;
                            var dataType = dataView.table.columns[c].type;
                            var labelValue = visuals.valueFormatter.format(rows[r][c], format);
                            labelValue = labelValue === null ? "(blank)" : labelValue;
                            var value;
                            if (rows[r][c] === null) {
                                value = powerbi.data.SQExprBuilder.nullConstant();
                            }
                            else {
                                if (dataType.text) {
                                    value = powerbi.data.SQExprBuilder.text(rows[r][c]);
                                }
                                else if (dataType.integer) {
                                    value = powerbi.data.SQExprBuilder.integer(rows[r][c]);
                                }
                                else if (dataType.numeric) {
                                    value = powerbi.data.SQExprBuilder.double(rows[r][c]);
                                }
                                else if (dataType.bool) {
                                    value = powerbi.data.SQExprBuilder.boolean(rows[r][c]);
                                }
                                else if (dataType.dateTime) {
                                    value = powerbi.data.SQExprBuilder.dateTime(rows[r][c]);
                                }
                                else {
                                    value = powerbi.data.SQExprBuilder.text(rows[r][c]);
                                }
                            }
                            var filterExpr = powerbi.data.SQExprBuilder.compare(powerbi.data.QueryComparisonKind.Equal, dataView.table.columns[c].expr ? dataView.table.columns[c].expr : dataView.categorical.categories[0].identityFields[c], value);
                            if (c > 0) {
                                parentExpr = powerbi.data.SQExprBuilder.and(parentExpr, filterExpr);
                            }
                            else {
                                parentId = "";
                                parentExpr = filterExpr;
                            }
                            var ownId = parentId + (parentId === "" ? "" : '_') + labelValue.replace(/,/g, '') + '-' + c;
                            var isLeaf = c === rows[r].length - 1;
                            var dataPoint = {
                                identity: null,
                                selected: selectedIds.filter(function (d) { return d === ownId; }).length > 0,
                                value: labelValue,
                                tooltip: labelValue,
                                level: c,
                                selectable: true,
                                partialSelected: false,
                                isLeaf: isLeaf,
                                isExpand: expandedIds === [] ? false : expandedIds.filter(function (d) { return d === ownId; }).length > 0 || false,
                                isHidden: c === 0 ? false : true,
                                id: filterExpr,
                                ownId: ownId,
                                parentId: parentId
                            };
                            parentId = ownId;
                            if (identityValues.indexOf(ownId) === -1) {
                                identityValues.push(ownId);
                                dataPoints.push(dataPoint);
                            }
                        }
                    }
                    // Set isHidden property
                    var parentRootNodes = [];
                    var parentRootNodesTemp = [];
                    var parentRootNodesTotal = [];
                    for (var l = 0; l < levels; l++) {
                        var expandedRootNodes = dataPoints.filter(function (d) { return d.isExpand && d.level === l; });
                        if (expandedRootNodes.length > 0) {
                            for (var n = 0; n < expandedRootNodes.length; n++) {
                                parentRootNodesTemp = parentRootNodes.filter(function (p) { return expandedRootNodes[n].parentId === p.ownId; }); //Is parent expanded?                        
                                if (l === 0 || (parentRootNodesTemp.length > 0)) {
                                    parentRootNodesTotal = parentRootNodesTotal.concat(expandedRootNodes[n]);
                                    dataPoints.filter(function (d) { return d.parentId === expandedRootNodes[n].ownId && d.level === l + 1; }).forEach(function (d) { return d.isHidden = false; });
                                }
                            }
                        }
                        parentRootNodes = parentRootNodesTotal;
                    }
                    return {
                        dataPoints: dataPoints,
                        settings: defaultSettings,
                        levels: levels,
                        hasSelectionOverride: true,
                    };
                };
                HierarchySlicer.prototype.init = function (options) {
                    var _this = this;
                    var hostServices = this.hostServices = options.host;
                    this.element = options.element;
                    this.viewport = options.viewport;
                    this.hostServices = options.host;
                    this.hostServices.canSelect = function () { return true; };
                    this.settings = HierarchySlicer.DefaultSlicerSettings();
                    this.selectionManager = new SelectionManager({ hostServices: options.host });
                    this.selectionManager.clear();
                    if (this.behavior)
                        this.interactivityService = visuals.createInteractivityService(hostServices);
                    this.slicerContainer = d3.select(this.element.get(0)).append('div').classed(HierarchySlicer.Container.class, true);
                    this.slicerHeader = this.slicerContainer.append('div').classed(HierarchySlicer.Header.class, true);
                    this.slicerHeader.append('span').classed(HierarchySlicer.Clear.class, true).attr('title', 'Clear');
                    this.slicerHeader.append('span').classed(HierarchySlicer.Expand.class, true).classed(HierarchySlicer.Clear.class, true).attr('title', 'Expand all');
                    this.slicerHeader.append('span').classed(HierarchySlicer.Collapse.class, true).classed(HierarchySlicer.Clear.class, true).attr('title', 'Collapse all');
                    this.slicerHeader.append('div').classed(HierarchySlicer.HeaderText.class, true);
                    this.slicerBody = this.slicerContainer.append('div').classed(HierarchySlicer.Body.class, true).style({
                        'height': PixelConverter.toString(this.viewport.height),
                        'width': PixelConverter.toString(this.viewport.width),
                    });
                    var rowEnter = function (rowSelection) {
                        _this.onEnterSelection(rowSelection);
                    };
                    var rowUpdate = function (rowSelection) {
                        _this.onUpdateSelection(rowSelection, _this.interactivityService);
                    };
                    var rowExit = function (rowSelection) {
                        rowSelection.remove();
                    };
                    var treeViewOptions = {
                        rowHeight: this.getRowHeight(),
                        enter: rowEnter,
                        exit: rowExit,
                        update: rowUpdate,
                        loadMoreData: function () { return _this.onLoadMoreData(); },
                        scrollEnabled: true,
                        viewport: this.getBodyViewport(this.viewport),
                        baseContainer: this.slicerBody,
                        isReadMode: function () {
                            return (_this.hostServices.getViewMode() !== powerbi.ViewMode.Edit);
                        }
                    };
                    this.treeView = TreeViewFactory.createListView(treeViewOptions);
                };
                HierarchySlicer.prototype.update = function (options) {
                    this.viewport = options.viewport;
                    this.dataView = options.dataViews ? options.dataViews[0] : undefined;
                    if (options.viewport.height === this.viewport.height && options.viewport.width === this.viewport.width) {
                        this.waitingForData = false;
                    }
                    this.updateInternal(false);
                };
                HierarchySlicer.prototype.onDataChanged = function (options) {
                    var dataViews = options.dataViews;
                    if (_.isEmpty(dataViews)) {
                        return;
                    }
                    var existingDataView = this.dataView;
                    this.dataView = dataViews[0];
                    var resetScrollbarPosition = options.operationKind !== powerbi.VisualDataChangeOperationKind.Append && !powerbi.DataViewAnalysis.hasSameCategoryIdentity(existingDataView, this.dataView);
                    this.updateInternal(resetScrollbarPosition);
                };
                HierarchySlicer.prototype.onResizing = function (viewPort) {
                    this.viewport = viewPort;
                    this.updateInternal(false);
                };
                HierarchySlicer.prototype.updateInternal = function (resetScrollbar) {
                    this.updateSlicerBodyDimensions();
                    var dataView = this.dataView, data = this.data = this.converter(dataView);
                    this.maxLevels = this.data.levels + 1;
                    if (data.dataPoints.length === 0) {
                        this.treeView.empty();
                        return;
                    }
                    this.settings = this.data.settings;
                    this.updateSettings();
                    this.treeView.viewport(this.getBodyViewport(this.viewport)).rowHeight(this.settings.slicerText.height).data(data.dataPoints.filter(function (d) { return !d.isHidden; }), function (d) { return $.inArray(d, data.dataPoints); }, resetScrollbar).render();
                };
                HierarchySlicer.prototype.updateSettings = function () {
                    this.updateSelectionStyle();
                    this.updateFontStyle();
                    this.updateHeaderStyle();
                };
                HierarchySlicer.prototype.updateSelectionStyle = function () {
                    var objects = this.dataView && this.dataView.metadata && this.dataView.metadata.objects;
                    if (objects) {
                        this.slicerContainer.classed('isMultiSelectEnabled', !powerbi.DataViewObjects.getValue(objects, HierarchySlicer1458836712039.hierarchySlicerProperties.selection.singleselect, this.settings.general.singleselect));
                    }
                };
                HierarchySlicer.prototype.updateFontStyle = function () {
                    var objects = this.dataView && this.dataView.metadata && this.dataView.metadata.objects;
                    if (objects) {
                        this.settings.slicerText.fontColor = powerbi.DataViewObjects.getFillColor(objects, HierarchySlicer1458836712039.hierarchySlicerProperties.items.fontColor, this.settings.slicerText.fontColor);
                        this.settings.slicerText.background = powerbi.DataViewObjects.getFillColor(objects, HierarchySlicer1458836712039.hierarchySlicerProperties.items.background, this.settings.slicerText.background);
                        this.settings.slicerText.textSize = powerbi.DataViewObjects.getValue(objects, HierarchySlicer1458836712039.hierarchySlicerProperties.items.textSize, this.settings.slicerText.textSize);
                    }
                };
                HierarchySlicer.prototype.updateHeaderStyle = function () {
                    var objects = this.dataView && this.dataView.metadata && this.dataView.metadata.objects;
                    if (objects) {
                        this.settings.header.fontColor = powerbi.DataViewObjects.getFillColor(objects, HierarchySlicer1458836712039.hierarchySlicerProperties.header.fontColor, this.settings.header.fontColor);
                        this.settings.header.background = powerbi.DataViewObjects.getFillColor(objects, HierarchySlicer1458836712039.hierarchySlicerProperties.header.background, this.settings.header.background);
                        this.settings.header.textSize = powerbi.DataViewObjects.getValue(objects, HierarchySlicer1458836712039.hierarchySlicerProperties.header.textSize, this.settings.header.textSize);
                    }
                };
                HierarchySlicer.prototype.updateSlicerBodyDimensions = function () {
                    var slicerViewport = this.getBodyViewport(this.viewport);
                    this.slicerBody.style({
                        'height': PixelConverter.toString(slicerViewport.height),
                        'width': '100%',
                    });
                };
                HierarchySlicer.prototype.onEnterSelection = function (rowSelection) {
                    var settings = this.settings;
                    var treeItemElementParent = rowSelection.append('li').classed(HierarchySlicer.ItemContainer.class, true).style({ 'background-color': settings.slicerText.background });
                    // Expand/collapse
                    if (this.maxLevels > 1) {
                        treeItemElementParent.each(function (d, i) {
                            var item = d3.select(this);
                            item.append('div').classed(HierarchySlicer.ItemContainerExpander.class, true).append('i').classed("collapse-icon", true).classed("expanded-icon", d.isExpand).style("visibility", d.isLeaf ? "hidden" : "visible");
                        });
                    }
                    var treeItemElement = treeItemElementParent.append('div').classed(HierarchySlicer.ItemContainerChild.class, true);
                    var labelElement = treeItemElement.append('div').classed(HierarchySlicer.Input.class, true);
                    labelElement.append('input').attr('type', 'checkbox');
                    labelElement.append('span').classed(HierarchySlicer.Checkbox.class, true);
                    treeItemElement.each(function (d, i) {
                        var item = d3.select(this);
                        item.append('span').classed(HierarchySlicer.LabelText.class, true).style({
                            'color': settings.slicerText.fontColor,
                            'font-size': PixelConverter.fromPoint(settings.slicerText.textSize)
                        });
                    });
                    var maxLevel = this.maxLevels;
                    treeItemElementParent.each(function (d, i) {
                        var item = d3.select(this);
                        item.style('padding-left', (maxLevel === 1 ? 8 : (d.level * 15)) + 'px');
                    });
                };
                HierarchySlicer.prototype.onUpdateSelection = function (rowSelection, interactivityService) {
                    var settings = this.settings;
                    var data = this.data;
                    if (data) {
                        if (settings.header.show) {
                            this.slicerHeader.style('display', 'block');
                        }
                        else {
                            this.slicerHeader.style('display', 'none');
                        }
                        this.slicerHeader.select(HierarchySlicer.HeaderText.selector).text(settings.header.title.trim());
                        this.slicerHeader.style({
                            'color': settings.header.fontColor,
                            'background-color': settings.header.background,
                            'border-style': 'solid',
                            'border-color': settings.general.outlineColor,
                            'border-width': this.getBorderWidth(settings.header.outline, settings.header.outlineWeight),
                            'font-size': PixelConverter.fromPoint(settings.header.textSize),
                        });
                        this.slicerBody.classed('slicerBody', true);
                        var slicerText = rowSelection.selectAll(HierarchySlicer.LabelText.selector);
                        slicerText.text(function (d) {
                            return d.value;
                        });
                        if (interactivityService && this.slicerBody) {
                            var body = this.slicerBody.attr('width', this.viewport.width);
                            var expanders = body.selectAll(HierarchySlicer.ItemContainerExpander.selector);
                            var slicerItemContainers = body.selectAll(HierarchySlicer.ItemContainerChild.selector);
                            var slicerItemLabels = body.selectAll(HierarchySlicer.LabelText.selector);
                            var slicerItemInputs = body.selectAll(HierarchySlicer.Input.selector);
                            var slicerClear = this.slicerHeader.select(HierarchySlicer.Clear.selector);
                            var slicerExpand = this.slicerHeader.select(HierarchySlicer.Expand.selector);
                            var slicerCollapse = this.slicerHeader.select(HierarchySlicer.Collapse.selector);
                            var behaviorOptions = {
                                hostServices: this.hostServices,
                                dataPoints: data.dataPoints,
                                expanders: expanders,
                                slicerContainer: this.slicerContainer,
                                slicerItemContainers: slicerItemContainers,
                                slicerItemLabels: slicerItemLabels,
                                slicerItemInputs: slicerItemInputs,
                                slicerClear: slicerClear,
                                slicerExpand: slicerExpand,
                                slicerCollapse: slicerCollapse,
                                interactivityService: interactivityService,
                                slicerSettings: data.settings,
                                levels: data.levels,
                            };
                            try {
                                interactivityService.bind(data.dataPoints, this.behavior, behaviorOptions, {
                                    overrideSelectionFromData: true,
                                    hasSelectionOverride: data.hasSelectionOverride
                                });
                            }
                            catch (e) {
                            }
                            this.behavior.styleSlicerInputs(rowSelection.select(HierarchySlicer.ItemContainerChild.selector), interactivityService.hasSelection());
                        }
                        else {
                            this.behavior.styleSlicerInputs(rowSelection.select(HierarchySlicer.ItemContainerChild.selector), false);
                        }
                    }
                };
                HierarchySlicer.prototype.onLoadMoreData = function () {
                    if (!this.waitingForData && this.dataView.metadata && this.dataView.metadata.segment) {
                        this.hostServices.loadMoreData();
                        this.waitingForData = true;
                    }
                };
                HierarchySlicer.getTextProperties = function (textSize) {
                    return {
                        fontFamily: HierarchySlicer.DefaultFontFamily,
                        fontSize: PixelConverter.fromPoint(textSize || HierarchySlicer.DefaultFontSizeInPt),
                    };
                };
                HierarchySlicer.prototype.getHeaderHeight = function () {
                    return powerbi.TextMeasurementService.estimateSvgTextHeight(HierarchySlicer.getTextProperties(this.settings.header.textSize));
                };
                HierarchySlicer.prototype.getRowHeight = function () {
                    return powerbi.TextMeasurementService.estimateSvgTextHeight(HierarchySlicer.getTextProperties(this.settings.slicerText.textSize));
                };
                HierarchySlicer.prototype.getBodyViewport = function (currentViewport) {
                    var settings = this.settings;
                    var headerHeight;
                    var slicerBodyHeight;
                    if (settings) {
                        headerHeight = settings.header.show ? this.getHeaderHeight() : 0;
                        slicerBodyHeight = currentViewport.height - (headerHeight + settings.header.borderBottomWidth);
                    }
                    else {
                        headerHeight = 0;
                        slicerBodyHeight = currentViewport.height - (headerHeight + 1);
                    }
                    return {
                        height: slicerBodyHeight,
                        width: currentViewport.width
                    };
                };
                HierarchySlicer.prototype.getBorderWidth = function (outlineElement, outlineWeight) {
                    switch (outlineElement) {
                        case 'None':
                            return '0px';
                        case 'BottomOnly':
                            return '0px 0px ' + outlineWeight + 'px 0px';
                        case 'TopOnly':
                            return outlineWeight + 'px 0px 0px 0px';
                        case 'TopBottom':
                            return outlineWeight + 'px 0px ' + outlineWeight + 'px 0px';
                        case 'LeftRight':
                            return '0px ' + outlineWeight + 'px 0px ' + outlineWeight + 'px';
                        case 'Frame':
                            return outlineWeight + 'px';
                        default:
                            return outlineElement.replace("1", outlineWeight.toString());
                    }
                };
                HierarchySlicer.prototype.enumerateObjectInstances = function (options) {
                    var instances = [];
                    var objects = this.dataView.metadata.objects;
                    switch (options.objectName) {
                        case "selection":
                            var selectionOptions = {
                                objectName: "selection",
                                displayName: "Selection",
                                selector: null,
                                properties: {
                                    singleSelect: powerbi.DataViewObjects.getValue(objects, HierarchySlicer1458836712039.hierarchySlicerProperties.selection.singleselect, this.settings.general.singleselect),
                                }
                            };
                            instances.push(selectionOptions);
                            break;
                        case "header":
                            var headerOptions = {
                                objectName: "header",
                                displayName: "Header",
                                selector: null,
                                properties: {
                                    title: powerbi.DataViewObjects.getValue(objects, HierarchySlicer1458836712039.hierarchySlicerProperties.header.title, this.settings.header.title),
                                    fontColor: powerbi.DataViewObjects.getFillColor(objects, HierarchySlicer1458836712039.hierarchySlicerProperties.header.fontColor, this.settings.header.fontColor),
                                    background: powerbi.DataViewObjects.getFillColor(objects, HierarchySlicer1458836712039.hierarchySlicerProperties.header.background, this.settings.header.background),
                                    textSize: powerbi.DataViewObjects.getValue(objects, HierarchySlicer1458836712039.hierarchySlicerProperties.header.textSize, this.settings.header.textSize),
                                }
                            };
                            instances.push(headerOptions);
                            break;
                        case "items":
                            var items = {
                                objectName: "items",
                                displayName: "Items",
                                selector: null,
                                properties: {
                                    fontColor: powerbi.DataViewObjects.getFillColor(objects, HierarchySlicer1458836712039.hierarchySlicerProperties.items.fontColor, this.settings.slicerText.fontColor),
                                    background: powerbi.DataViewObjects.getFillColor(objects, HierarchySlicer1458836712039.hierarchySlicerProperties.items.background, this.settings.slicerText.background),
                                    textSize: powerbi.DataViewObjects.getValue(objects, HierarchySlicer1458836712039.hierarchySlicerProperties.items.textSize, this.settings.slicerText.textSize),
                                }
                            };
                            instances.push(items);
                            break;
                    }
                    return instances;
                };
                HierarchySlicer.capabilities = {
                    dataRoles: [{
                        name: 'Fields',
                        kind: powerbi.VisualDataRoleKind.Grouping,
                        displayName: 'Fields'
                    }, {
                        name: 'Values',
                        kind: powerbi.VisualDataRoleKind.Measure,
                        displayName: 'Values',
                    }],
                    dataViewMappings: [{
                        conditions: [{
                            'Values': { min: 0, max: 1 }
                        }],
                        table: {
                            rows: {
                                for: { in: 'Fields' },
                                dataReductionAlgorithm: { bottom: { count: 4000 } }
                            },
                        }
                    }],
                    objects: {
                        general: {
                            displayName: 'General',
                            properties: {
                                filter: {
                                    type: { filter: {} }
                                },
                                filterValues: {
                                    type: { text: true }
                                },
                                expanded: {
                                    type: { text: true }
                                },
                                hidden: {
                                    type: { text: true }
                                },
                                defaultValue: {
                                    type: { expression: { defaultValue: true } },
                                },
                                formatString: {
                                    type: {
                                        formatting: { formatString: true }
                                    },
                                },
                            },
                        },
                        selection: {
                            displayName: 'Selection',
                            properties: {
                                singleSelect: {
                                    displayName: 'Single Select',
                                    type: { bool: true }
                                }
                            },
                        },
                        header: {
                            displayName: 'Header',
                            properties: {
                                title: {
                                    displayName: 'Title',
                                    type: { text: true }
                                },
                                fontColor: {
                                    displayName: 'Font color',
                                    description: 'Font color of the title',
                                    type: { fill: { solid: { color: true } } }
                                },
                                background: {
                                    displayName: 'Background',
                                    type: { fill: { solid: { color: true } } }
                                },
                                textSize: {
                                    displayName: 'Text Size',
                                    type: { formatting: { fontSize: true } }
                                },
                            },
                        },
                        items: {
                            displayName: 'Items',
                            properties: {
                                fontColor: {
                                    displayName: 'Font color',
                                    description: 'Font color of the cells',
                                    type: { fill: { solid: { color: true } } }
                                },
                                background: {
                                    displayName: 'Background',
                                    type: { fill: { solid: { color: true } } }
                                },
                                textSize: {
                                    displayName: 'Text Size',
                                    type: { formatting: { fontSize: true } }
                                },
                            },
                        },
                        privacy: {
                            displayName: "Privacy",
                            properties: {
                                version: {
                                    displayName: "Version",
                                    type: { text: true },
                                    placeHolderText: "Placeholder",
                                },
                            },
                        }
                    },
                    supportsHighlight: true,
                    suppressDefaultTitle: true,
                    filterMappings: {
                        measureFilter: { targetRoles: ['Fields'] },
                    },
                    sorting: {
                        default: {},
                    },
                };
                HierarchySlicer.formatStringProp = {
                    objectName: "general",
                    propertyName: "formatString",
                };
                HierarchySlicer.DefaultFontFamily = 'Segoe UI, Tahoma, Verdana, Geneva, sans-serif';
                HierarchySlicer.DefaultFontSizeInPt = 11;
                HierarchySlicer.Container = createClassAndSelector('slicerContainer');
                HierarchySlicer.Body = createClassAndSelector('slicerBody');
                HierarchySlicer.ItemContainer = createClassAndSelector('slicerItemContainer');
                HierarchySlicer.ItemContainerExpander = createClassAndSelector('slicerItemContainerExpander');
                HierarchySlicer.ItemContainerChild = createClassAndSelector('slicerItemContainerChild');
                HierarchySlicer.LabelText = createClassAndSelector('slicerText');
                HierarchySlicer.CountText = createClassAndSelector('slicerCountText');
                HierarchySlicer.Checkbox = createClassAndSelector('checkbox');
                HierarchySlicer.Header = createClassAndSelector('slicerHeader');
                HierarchySlicer.HeaderText = createClassAndSelector('headerText');
                HierarchySlicer.Collapse = createClassAndSelector('collapse');
                HierarchySlicer.Expand = createClassAndSelector('expand');
                HierarchySlicer.Clear = createClassAndSelector('clear');
                HierarchySlicer.Input = createClassAndSelector('slicerCheckbox');
                return HierarchySlicer;
            })();
            HierarchySlicer1458836712039.HierarchySlicer = HierarchySlicer;
        })(HierarchySlicer1458836712039 = visuals.HierarchySlicer1458836712039 || (visuals.HierarchySlicer1458836712039 = {}));
    })(visuals = powerbi.visuals || (powerbi.visuals = {}));
})(powerbi || (powerbi = {}));
var powerbi;
(function (powerbi) {
    var visuals;
    (function (visuals) {
        var plugins;
        (function (plugins) {
            plugins.HierarchySlicer1458836712039 = {
                name: 'HierarchySlicer1458836712039',
                class: 'HierarchySlicer1458836712039',
                capabilities: powerbi.visuals.HierarchySlicer1458836712039.HierarchySlicer.capabilities,
                custom: true,
                create: function (options) { return new powerbi.visuals.HierarchySlicer1458836712039.HierarchySlicer(options); },
                apiVersion: null
            };
        })(plugins = visuals.plugins || (visuals.plugins = {}));
    })(visuals = powerbi.visuals || (powerbi.visuals = {}));
})(powerbi || (powerbi = {}));
