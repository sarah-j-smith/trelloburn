/* 
See https://trello.com/docs for a list of available API URLs

*/

var graphData = [];
    
var boardData = [];

var controlData = { 'boardCount': 0, 'cardCount': 0, 'reportedCards': 0, 'cards': {}, 'boards':{}, 'enabledBoards': {}, 'members': {}, 'wasError': false };

var prefs = { 'boards': [] };

var updateSelectedBoards = function() {
    var name = this.name;
    controlData.enabledBoards[name] = this.checked;
    updateBoardData();
}

var updatePrefs = function() {
    prefs.startDate = $('#startdate').val();
    prefs.endDate = $('#enddate').val();
    prefs.boards = [];
    $.each(controlData.enabledBoards, function(boardId, enabled) {
        if (enabled) {
            prefs.boards.push(boardId);
        }
    });
    Cookies.set('prefs', prefs);
}

var loadPrefs = function() {
    tryPrefs = Cookies.getJSON('prefs');
    if (tryPrefs) {
        prefs = tryPrefs;
    }
    else
    {
        prefs = { 'startDate': undefined, 'endDate': undefined, 'boards': [] };
    }
}

var updateBoardData = function() {
    $('#updatingmessage').toggle(true);
    controlData.cardCount = 0;
    controlData.reportedCards = 0;
    controlData.wasError = false;
    controlData.cards = {};
    var enabledCount = 0;
    $('#cardscontainer').empty();
    drawHeaderRow();
    updatePrefs();
    $.each(controlData.enabledBoards, function(boardId, enabled) {
        if (enabled) {
            enabledCount++;
            processDataForBoard(boardId);
        }
    });
    $("#cardsreport").toggle(enabledCount > 0);
    $("#prompt").toggle(enabledCount == 0);
}

var drawHeaderRow = function() {
    var $row = $("<tr>").appendTo('#cardscontainer');
    var headings = [ 'Status', 'Story/Card Name', 'Assigned', 'Points', 'Date Done'];
    for (var h = 0; h < 5; ++h) {
        var $th = $("<th>").text(headings[h]).appendTo($row);
    }
}

var reportAssignee = function(assigneeId, parentElement) {
    if ("assigneeId" in controlData.members) {
        var $badge = $("<span>").addClass("badge").appendTo(parentElement);
        $("<td>").text(controlData.members[assigneeId]).appendTo($badge);
    } else {
        Trello.get("members/" + assigneeId + "?fields=initials", function(member) {
            var $badge = $("<span>").addClass("badge").appendTo(parentElement);
            $("<td>").text(controlData.members[assigneeId]).appendTo($badge);
            controlData.members[assigneeId] = member.initials;
        });
    }
}

var reportOnCard = function(card) {
    var results = controlData.cards[card.id];
    var $row = $("<tr>").appendTo('#cardscontainer');
    var $iconcell = $("<td>").appendTo($row);
    var $alertspan = $("<span>").addClass("glyphicon").appendTo($iconcell);
    if (results.points > 0.0) {
        if (results.done) {
            $alertspan.addClass("glyphicon-ok").attr('title', 'Completed');
            $alertspan.addClass("ssokstyle");
        }
        else
        {
            $alertspan.addClass("glyphicon-time").attr('title', 'In Progress');
            $alertspan.addClass("sswarningstyle");
        }
    }
    else
    {
        $alertspan.addClass("glyphicon-alert").attr('title', 'Missing data');
        $alertspan.addClass("sserrorstyle");
        controlData.wasError = true;
    }
    $alertspan.attr('aria-hidden', true);
    var $element = $("<td>").appendTo($row);
    var $link = $("<a>", { 'href': card.url }).addClass("card").text(results.name.substring(0,30)).attr('href', card.url).appendTo($element);
    $link.attr('title', results.name).attr('alt', results.name);

    var $memb = $("<td>").appendTo($row);
    if (card.idMembers.length > 0)
    {
        var memberCount = card.idMembers.length;
        for (var ix = 0; ix < memberCount; ++ix) {
            reportAssignee(card.idMembers[ix], $memb);  
        }
    }
    else
    {
        $memb.text("?")
    }
    
    var $points = $("<td>").text(results.points).appendTo($row);
    if (results.done) {
        var resultDate = new Date(results.date);
        var $outdate = $.datepicker.formatDate('dd/mm/yy', resultDate);
        $("<td>").text($outdate).appendTo($row);
    }
    else {
        $("<td>").text("-").appendTo($row);
    }
}

var processDataForCard = function(card) {
    Trello.get("cards/" + card.id + "/actions", function(actions) {
        $.each(actions, function(ix, action){
            if (action.type == 'updateCard' && action.data.listAfter.name == 'Done')
            {
                controlData.cards[card.id]['done'] = true;
                controlData.cards[card.id]['date'] = action.date;
                return false;
            }
        });
        reportOnCard(card);
        controlData.reportedCards += 1;
        if (controlData.reportedCards == controlData.cardCount) {
            drawCurveTypes();
            $('#waserror').toggle(controlData.wasError);
            $('#updatingmessage').toggle(false);
        }
    });
}

var processDataForBoard = function (board) {
    controlData.boards[board] = {};
    Trello.get("boards/" + board + "/cards/open?fields=name,url,idMembers", function (cards) {
        // names are like (estimated points) -- [consumed points]
        // (2) Data Block - Data Passing [2]
        var rxEst = /\(([^\)]+)\)/ ;
        var rxCon = /\[([^\]]+)\]/ ;
        controlData.cardCount += cards.length;
        $.each(cards, function (ix, card) {
            controlData.boards[board][card.id] = {}
            var results = { "est": -1, "con": -1 };
            var trimmedName = card.name;
            var con = rxCon.exec(trimmedName);
            var est = rxEst.exec(trimmedName);
            var pointsDone = 0.0;
            if (est) {
                trimmedName = trimmedName.replace(est[0], "");
                pointsDone = Math.max(pointsDone, parseFloat(est[1]));
            }
            if (con) {
                trimmedName = trimmedName.replace(con[0], "");
                pointsDone = Math.max(pointsDone, parseFloat(con[1]));
            }
            trimmedName = trimmedName.trim();
            results['name'] = trimmedName;
            results['points'] = pointsDone;
            results['done'] = false;
            results['date'] = new Date();
            controlData.cards[card.id] = results;
            processDataForCard(card);
        });
    });
}

var createDateFields = function (element) {
    var $startlabel = $("<label>").text('Sprint start:').appendTo(element);
    var $startdate = $("<input>", { class: 'datepicker', type: 'textbox', name: 'startdate', id: 'startdate' }).appendTo($startlabel);


    $startdate.datepicker({
        dateFormat: 'dd/mm/y',
        onSelect: function (selected) {
            $("#enddate").datepicker("option", "minDate", selected);
        }
    });
    
    var $endlabel = $("<label>").text('Sprint end:').appendTo(element);
    var $enddate = $("<input>", { class: 'datepicker', type: 'textbox', name: 'enddate', id: 'enddate' }).appendTo($endlabel);
    $enddate.datepicker({
        dateFormat: 'dd/mm/y',
        onSelect: function (selected) {
            $("#startdate").datepicker("option", "maxDate", selected);
        }
    });

    var controlEndDate = moment();
    var controlStartDate = moment().subtract(14, 'days');
    if ('startDate' in prefs)
    {
        var tryControlStartDate = moment(prefs.startDate, "DD/MM/YY");
        if (tryControlStartDate.isValid()) {
            controlStartDate = tryControlStartDate;
        }
    }
    if ('endDate' in prefs)
    {
        var tryControlEndDate = moment(prefs.endDate, "DD/MM/YY");
        if (tryControlEndDate.isValid()) {
            controlEndDate = tryControlEndDate;
        }
    }
    
    $startdate.val(controlStartDate.format("DD/MM/YY"));
    $enddate.val(controlEndDate.format("DD/MM/YY"));
    
    controlData.startDate = controlStartDate;
    controlData.endDate = controlEndDate;
    
    var controlVelocity = 14;
    if ('velocity' in prefs) {
        controlVelocity = prefs.velocity;
    }
    var $velocityLabel = $("<label>").text('Velocity:').appendTo(element);
    var $velocityVal = $("<input>", { class: 'form-control', type: 'number', name: 'velocity', id: 'velocity' }).appendTo($velocityLabel);
    $velocityVal.bind('keyup mouseup', drawCurveTypes);
    $velocityVal.val(controlVelocity);
}

var onAuthorize = function() {
    updateLoggedIn();
    $("#output").empty();
    
    Trello.members.get("me", function(member){
        $("#fullName").text(member.fullName);
    
        var $boards = $("<div>")
            .text("Loading Boards...")
            .appendTo("#boardsoutput");

        Trello.get("members/me/boards", function(boards){
            $boards.empty();
            $.each(boards, function (ix, board) {
                if (board.name.indexOf('Sprint') > -1) {
                    var $cbdiv = $("<div>").addClass("checkbox").appendTo($boards);
                    var $lb = $("<label>").appendTo($cbdiv);
                    var $enable = true;
                    if ('boards' in prefs)
                    {
                        $enable = false;
                        if (prefs.boards.indexOf(board.id) > -1)
                        {
                            $enable = true;
                        }
                    }
                    controlData['enabledBoards'][board.id] = $enable;
                    var $cb = $("<input>", { type: 'checkbox', name: board.id, id: 'cb' + ix }).appendTo($lb).click(updateSelectedBoards);
                    $cb.prop('checked', $enable);
                    $lb.append(board.name);
                }
            });
            createDateFields($boards);
            updateBoardData();
        });
    });
};

var updateLoggedIn = function() {
    var isLoggedIn = Trello.authorized();
    $("#loggedout").toggle(!isLoggedIn);
    $("#loggedin").toggle(isLoggedIn);
    $("#boardsreport").toggle(isLoggedIn);
    $("#cardsreport").toggle(isLoggedIn && controlData['cardsCount'] > 0);        
};
    
var logout = function() {
    Trello.deauthorize();
    updateLoggedIn();
};

function trelloSetup() {
    $('#updatingmessage').toggle(false);
    $('#refreshbutton').click(updateBoardData);
    
    loadPrefs();
    
    Trello.authorize({
        interactive: false,
        success: onAuthorize
    });

    $("#connectLink")
        .click(function () {
            Trello.authorize({
                type: "popup",
                name: "Smithsoft Projects",
                success: onAuthorize,
                scope: { write: true, read: true }
            })
        });

    $("#disconnect").click(logout);
}                          

function runCharts() {
    google.charts.load('current', { packages: ['corechart', 'line'] });
    google.charts.setOnLoadCallback(drawCurveTypes);
}

function drawCurveTypes() {
    var velocity = 14;
    if ($('#velocity').length) {
        velocity = parseInt($('#velocity').val(), 10);
    }
    var dailyVelocity = velocity / 14.0;
    
    var startDate = moment($('#startdate').val(), "DD/MM/YY");
    var endDate = moment($('#enddate').val(), "DD/MM/YY");
    if (!startDate.isValid() || !endDate.isValid())
    {
        return;
    }
    
    graphData = [];
    var diffDays = endDate.diff(startDate, 'days') + 1;
    var pointsDay = moment(startDate);
    
    // Fill the array with a data point (the date) for each day 
    // from start - end, inclusive; with zeroes for the points
    for (var i = 0; i < diffDays; ++i) {
        var thisDay = moment(pointsDay);
        graphData.push([ thisDay.toDate(), 0.0, 0.0 ]);
        pointsDay.add(1, 'days');
    }
    var maxDays = pointsDay.toDate();

    // Iterate over the cards data and for each card write the value
    // of its story points into the 'actual' column for all rows up
    // to the done date.
    for (var cardId in controlData.cards) {
        var card = controlData.cards[cardId];
        var dayDone = diffDays;
        if (card.done) {
            var dateDone = moment( new Date(card.date));
            dayDone = dateDone.diff(startDate, 'days');
        }
        if (dayDone > diffDays) 
        { 
            dayDone = diffDays; 
        }
        for (i = 0; i < dayDone; ++i) {
            graphData[i][1] = graphData[i][1] + parseFloat( card.points );
        }
    }
    
    // Now fill the estimates row by monotonically reducing the value
    // from the max points down by the velocity multiplied by the days
    var maxPoints = graphData[0][1];
    if (maxPoints > 10) {
        for (i = 0; i < diffDays; ++i) {
            graphData[i][2] = Math.max(0.0, maxPoints - i * dailyVelocity);
        }
    }
    
    maxPoints = maxPoints * 1.1;    
            
    var data = new google.visualization.DataTable();
    data.addColumn('date', 'Time in Days');
    data.addColumn('number', 'Actual');
    data.addColumn('number', 'Expected');

    data.addRows(graphData);

    var options = {
        width: 900,
        height: 500,
        hAxis: {
            title: 'Time (Days)',
            format:'d/M'
        },
        vAxis: {
            viewWindowMode:'explicit',
              viewWindow:{
                max:maxPoints,
                min:0
              },
            title: 'Story Points'
        },
        series: {
            1: { curveType: 'function' }
        }
    };

    // var chart = new google.visualization.LineChart(document.getElementById('chart_div'));
    var chart = new google.charts.Line(document.getElementById('chart_div'));

    /* chart.draw(data, options); */
    chart.draw(data, google.charts.Line.convertOptions(options));
}