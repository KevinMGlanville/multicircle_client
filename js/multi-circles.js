/**
 * @author Kevin Glanville
 * @author Curtis Clements
 * @author Jake Pitkin
 */


// initialize vars on load
$(function() {
    var websocket_url = "ws://" + window.location.hostname + ":8080";
    // declare ws up here so we can swap it out
    var ws;

    // 'buffer' for moves in case the local client runs the simulation slow than the remote client
    var stored_move = "";

    // clicking 'open' creates a new socket at the url entered
    ws = new WebSocket(websocket_url);

    // swap buttons around when socket is open
    ws.onopen = function open() {
        conn_status = "connected";
    };

    ws.onclose = function (event) {
        conn_status = "not connected";
    };

    ws.onmessage = function (event) {
        var message_object = JSON.parse(event.data);

        // process remote move
        if(message_object['message'] == 'move'){
            stored_move = message_object;
            if(game_state == StateEnum.WAITING_FOR_REMOTE_MOVE){
                process_remote_move();
            }
        }

        if(message_object['message'] == 'opponent exit'){
            message = 'Opponent left';
            ws.close();
        }

        // assign players
        if(message_object['message'] == 'player1'){
            local_player = 'player1';
            myColor = PlayerColors.P1;
            oppColor = PlayerColors.P2;
            changeGameState(StateEnum.WAITING_FOR_LOCAL_MOVE);
        }
        if(message_object['message'] == 'player2'){
            local_player = 'player2';
            myColor = PlayerColors.P2
            oppColor = PlayerColors.P1;
            changeGameState(StateEnum.WAITING_FOR_REMOTE_MOVE);
        }
    };

    $("#send").on('click', function (event) {
        var test_object = new Object();
        test_object['message'] = 'join';
        test_object['game'] = $("#text").val();
        var send_object = JSON.stringify(test_object);
        ws.send(send_object);
        $("#send").prop('disabled', true);
    });

    // circle handling
    var canvas1 = document.getElementById("canvas1");
    var context = canvas1.getContext("2d");
    context.canvas.width  = 800;
    context.canvas.height = 500;
    document.addEventListener("mousedown", mousePressed);
    document.addEventListener("mouseup", mouseReleased);
    document.addEventListener("mousemove", mouseMoved);
    document.addEventListener("touchstart", touchStart);
    document.addEventListener("touchend", touchEnd);
    document.addEventListener("touchmove", touchMove);

    var conn_status =  "not connected";
    var message = "";

    var circles = [], collisPairs = [];
    var mouseX = 0, mouseY = 0;
    var msPerFrame = 20;
    var xMin = 0, xMax = context.canvas.width, yMin = 0, yMax = context.canvas.height;
    var mPressed = false, mReleased = true, circleMarked = false;
    var markedCircle = -1;
    var shotMaxSpd = xMax / 75, shotSpdAdjust = 0.05, dragVal = 0.01, wallCoR = 0.8;
    var drag = true, ceiling = true;
    // The minimum speed a ball can move, used to change turns
    var minimumVelocity = 0.05;

    // 'player1' or 'player2'
    var local_player;

    var PlayerColors = {
        //var p1 = "rgb(255,105,97)";
        //var p2 = "rgb(96,130,182)";
        //var p1 = pastel(240, 240, 20);
        //var p2 = pastel(0, 255, 255);
        //var p2 = "rgb(0, 202, 53)";

        P1: "rgb(254, 159, 26)",
        P2: "rgb(200, 200, 200)"
    }

    var myColor = "rgb(0, 0, 0)", oppColor = "rgb(0, 0, 0)";

    // canvas color
    //$('#canvas1').css('background-color', pastel(0, 0, 0));
    $('#canvas1').css('background-color', "rgb(0, 0, 0)");
    var inertColor = "rgb(50, 50, 50)";

    // current highest velocity circle
    var high_velocity = 0;
    var audio_counter = 1;

    // enum defining possible game states
    var StateEnum = {
        START: "players haven't been assigned",
        WAITING_FOR_REMOTE_MOVE: "waiting for the remote player's move",
        WAITING_FOR_LOCAL_MOVE: "waiting for local player to make a move",
        WAITING_FOR_REMOTE_ZERO: "waiting for circles to reach zero velocity after remote move",
        WAITING_FOR_LOCAL_ZERO: "waiting for circles to reach zero velocity after local move"
    }
    var game_state;
    changeGameState(StateEnum.START);

    init();

    function init() {
        populateCirclesWP();
        setInterval(updateGame, msPerFrame);
    }

    // game world step
    function updateGame(){
        applyDrag();
        incPos(circles);
        wallCollision(circles, xMin, xMax, yMin, yMax, wallCoR, ceiling);
        collisions(circles, collisPairs, collisCallback);
        clipVelocities();
        changeTurns();
        clearCanvas();
        drawMessage();
        drawConnStatus();
        drawCircles(circles, context);
        drawTrajectory();
        mouseInteract();
    }

    // a circle with information
    function CircleWP(x, y, r, xv, yv, color) {
        this.x = x;
        this.y = y;
        this.r = r;
        this.xv = xv;
        this.yv = yv;
        this.m = 4/3 * Math.PI * Math.pow( this.r, 3);
        this.color = color;
    }

    function populateCirclesWP(){
        var voffset = 50;
        var pieces = 8;
        var r = 0;

        for(var i=0; i<pieces; i++){
            r = Math.sqrt((i + 5) * 40);
            circles[i] = new CircleWP(xMin + 50, yMin + r + voffset, r, 0, 0, i % 2 == 0 ? PlayerColors.P1 : inertColor);
            voffset += r * 2 + 15;
        }

        voffset = 50;
        r = 0;
        for(var i=0; i<pieces; i++){
            r = Math.sqrt((i + 5) * 40);
            circles[i+pieces] = new CircleWP(canvas1.width - xMin - 50, yMin + r + voffset, r, 0, 0, i % 2 == 0 ? PlayerColors.P2 : inertColor);
            voffset += r * 2 + 15;
        }

    }

    function pastel(r, g, b){
        return "rgb(" + Math.floor((r+255)/2) + "," + Math.floor((g+255)/2) + "," + Math.floor((b+255)/2) + ")";
    }

    // set circle velocity and game state
    function process_remote_move(){
        circles[stored_move['move_index']].xv = stored_move['move_xv'];
        circles[stored_move['move_index']].yv = stored_move['move_yv'];
        stored_move = "";
        changeGameState(StateEnum.WAITING_FOR_REMOTE_ZERO);
    }

    function changeGameState(gs){
        console.log('Change game state from: ' + game_state + ' to: ' + gs);
        game_state = gs;

        if(game_state == StateEnum.WAITING_FOR_LOCAL_ZERO ||
            game_state == StateEnum.WAITING_FOR_REMOTE_ZERO){
            message = '...';
        }
        if(game_state == StateEnum.WAITING_FOR_LOCAL_MOVE)
            message = "Your move";
        if(game_state == StateEnum.WAITING_FOR_REMOTE_MOVE)
            message = "Opponent's move";
    }

    // mouse and touchscreen events to track position
    function mousePressed(e){
        mPressed = true;
        mReleased = false;
        mouseX = e.clientX - canvas1.offsetLeft;
        mouseY = e.clientY - canvas1.offsetTop;
    }

    // mouse and touchscreen events to track position
    function touchStart(e){
        console.log(mouseX = e.targetTouches[0].clientX - canvas1.offsetLeft);
        mPressed = true;
        mReleased = false;
        mouseY = e.targetTouches[0].clientY - canvas1.offsetTop;
    }

    // mouse and touchscreen events to track position
    function mouseReleased(e){
        mPressed = false;
        mReleased = true;
        releaseCircle();
    }

    // mouse and touchscreen events to track position
    function touchEnd(e){
        mPressed = false;
        mReleased = true;
        releaseCircle();
    }

    // mouse and touchscreen events to track position
    function mouseMoved(e){
        if (mPressed) {
            mouseX = e.clientX - canvas1.offsetLeft;
            mouseY = e.clientY - canvas1.offsetTop;
        }
    }

    // mouse and touchscreen events to track position
    function touchMove(e){
        if (mPressed) {
            mouseX = e.targetTouches[0].clientX - canvas1.offsetLeft;
            mouseY = e.targetTouches[0].clientY - canvas1.offsetTop;
        }
    }

    // Releases a circle and sets velocity
    // This method does nothing if the selected ball isn't
    // yours or if it isn't your turn.
    function releaseCircle(){
        if(markedCircle > -1 &&
            circles[markedCircle].color == myColor &&
            game_state == StateEnum.WAITING_FOR_LOCAL_MOVE)
        {
            setMarkedVelocity();
            // Indicate the player made a move
            send_move();
            changeGameState(StateEnum.WAITING_FOR_LOCAL_ZERO);
        }
        markedCircle = -1
        circleMarked = false;
    }

    // scale the released circle's velocity to the maximum
    function setMarkedVelocity(){
        var originX = circles[markedCircle].x;
        var originY = circles[markedCircle].y;

        if( Math.abs(mouseX-originX) > 0 || Math.abs(mouseY-originY)>0) {
            var dist = distPoints(mouseX, mouseY, originX, originY);
            var xDiffUnit = (mouseX - originX) / dist;
            var yDiffUnit = (mouseY - originY) / dist;
            var velocity = Math.min(shotMaxSpd, dist * shotSpdAdjust);
            circles[markedCircle].xv = xDiffUnit * velocity;
            circles[markedCircle].yv = yDiffUnit * velocity;
        }
    }

    // send the moved circle to the server
    function send_move(){
        var circle_message = new Object();
        circle_message['message'] = 'move';
        circle_message['move_index'] = markedCircle;
        circle_message['move_xv'] = circles[markedCircle].xv;
        circle_message['move_yv'] = circles[markedCircle].yv;
        ws.send(JSON.stringify(circle_message));
    }

    // determine if a circle is under the touched/clicked position
    function markCircle() {
        if (mPressed && !circleMarked) {
            for (var i=0; i<circles.length; i++){
                var dist = distPoints(circles[i].x, circles[i].y, mouseX, mouseY);
                if (dist < circles[i].r){
                    circles[i].marked = true;
                    circleMarked = true;
                    markedCircle = i;
                }
            }
        }
    }

    // slow down the circles
    function applyDrag(){
        for(var i=0; i<circles.length; i++){
            if (drag){
                circles[i].xv *= (1-dragVal);
                circles[i].yv *= (1-dragVal);
            }
        }
    }

    // draw messages from the server
    function drawMessage(){

        // Check if the message should still be displayed
        if(message)
        {
            // Write the message
            context.fillStyle = "rgb(49, 245, 88)";
            context.font = '15pt Courier New';
            context.textBaseline = 'middle';
            context.textAlign = 'center';
            context.fillText(message,  canvas1.width / 2, canvas1.height / 2);
        }
    }

    // draw status of websocket connection
    function drawConnStatus(){
        context.fillStyle = "rgb(49, 245, 88)";
        context.font = '12pt Courier New';
        context.textBaseline = 'middle';
        context.textAlign = 'center';
        context.fillText(conn_status, xMax/2, 15);
    }

    // draw number of circles for each side
    function drawPlayerScores(){
        redScore = 0;
        greenScore = 0;
        for(var z = 0; z < circles.length; z++){
            var ballColor = circles[z].color;

            if (ballColor == myColor){
                redScore++;
            }
            else if(ballColor == oppColor){
                greenScore++;
            }
        }
        context.fillStyle = "black";
        context.font = '12pt Calibri';
        context.fillText("Red:" + redScore, 150, 15);
        context.fillText("Green:" + greenScore, 200, 15);
    }

    // mark circles with some information (useful for debugging)
    function drawCircleID(){
        for (var i=0; i<circles.length; i++){
            context.fillStyle = "black";
            context.font = '12pt Calibri';
            context.fillText(i.toString() + ' x:' + Math.round(circles[i].xv) + ' y:' + Math.round(circles[i].yv), circles[i].x, circles[i].y);
            //context.fillText(circles[i].yv, circles[i].x, circles[i].y);
            //context.fillText(circles[i].xv, circles[i].x, circles[i].y + 10);
        }
    }

    // cutoff velocities below minimum threshold
    function clipVelocities(){
        // Check if all balls velocity are under
        // a given minimum velocity
        high_velocity = 0;
        for (var i = 0; i < circles.length; i++)
        {
            // stop circles below min velocity
            var velocity = Math.sqrt( Math.pow(circles[i].xv, 2) + Math.pow(circles[i].yv, 2));
            if(velocity <= minimumVelocity)
            {
                circles[i].xv = 0;
                circles[i].yv = 0;
            }
            high_velocity = Math.max(velocity, high_velocity);
        }
    }

    // Tests if balls are moving but are under a
    // threshold velocity. If they are, changes the
    // turn and sends the position of each
    // ball on the screen to the opponent
    function changeTurns(){
        if (high_velocity == 0){
            // Tests if the player made a move and
            // if the moved ball is under a certain velocity
            if(game_state == StateEnum.WAITING_FOR_LOCAL_ZERO)
            {
                changeGameState(StateEnum.WAITING_FOR_REMOTE_MOVE);
                if(stored_move)
                    process_remote_move();
            }
            else{
                if(game_state == StateEnum.WAITING_FOR_REMOTE_ZERO)
                    changeGameState(StateEnum.WAITING_FOR_LOCAL_MOVE);
            }
        }
    }

    function mouseInteract(){
        markCircle();
    }

    function clearCanvas(){
        context.clearRect(xMin, yMin, xMax, yMax);
    }

    // called when there's a collision between circles in the collisPair
    function collisCallback(collisPair){
        if(audio_counter >4) audio_counter =1;
        document.getElementById("audio" + audio_counter++).play();

        // if collision is between two opposing colors, swap the colors appropriately
        var c1 = collisPair.c1, c2 = collisPair.c2;
        var colorSwap = false;
        if (c1.color != inertColor && c2.color != inertColor)
            colorSwap = true;
        if(colorSwap && game_state == StateEnum.WAITING_FOR_REMOTE_ZERO){
            collisPair.c1.color = oppColor;
            collisPair.c2.color = oppColor;
        }
        if(colorSwap && game_state == StateEnum.WAITING_FOR_LOCAL_ZERO){
            collisPair.c1.color = myColor;
            collisPair.c2.color = myColor;
        }
   }

    // draw a line that indicates the velocity to be applied to the circle
    // the maximum extent of the line indicates the point at which maximum velocity is applied
    function drawTrajectory(){
        if(mPressed && mouseX && markedCircle > -1){
            var originX = circles[markedCircle].x;
            var originY = circles[markedCircle].y;
            var dist = distPoints(mouseX, mouseY, originX, originY);
            var line_dist = Math.min( shotMaxSpd / shotSpdAdjust, dist);
            var x_unitv = (mouseX - originX) / dist;
            var y_unitv = (mouseY - originY) / dist;
            var finalX = x_unitv * line_dist + originX;
            var finalY = y_unitv * line_dist + originY;
            if(Math.abs(mouseX-originX) > 0 || Math.abs(mouseY-originY)>0) {
                context.beginPath();
                context.moveTo(originX, originY);
                context.lineTo(finalX, finalY);
                //context.strokeStyle = "rgb(100, 100, 100)";
                context.strokeStyle = "rgb(49, 245, 88)";
                context.lineWidth=2;
                //context.lineCap = "round";
                context.stroke();
            }
        }
    }

});
