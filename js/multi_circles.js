/**
 * Run a game client, including message handling, physics/drawing, and game state
 *
 * @author Kevin Glanville
 * @author Curtis Clements
 * @author Jake Pitkin
 */

// initialize vars on load
$(function() {

    //drawing area
    var game_canvas = document.getElementById("game_canvas");
    var context = game_canvas.getContext("2d");
    context.canvas.width  = 800;
    context.canvas.height = 500;

    // interaction events
    document.addEventListener("mousedown", mousePressed);
    document.addEventListener("mouseup", mouseReleased);
    document.addEventListener("mousemove", mouseMoved);
    game_canvas.addEventListener("touchstart", touchStart);
    game_canvas.addEventListener("touchend", touchEnd);
    game_canvas.addEventListener("touchmove", touchMove);

    // websocket for communications
    var websocket_url = "ws://" + window.location.hostname + ":8080";

    // 'buffer' for moves; necessary when moves are received from remote before local simulation is finish
    var stored_move = "";
    // clicking 'open' creates a new socket at the url entered
    var ws = new WebSocket(websocket_url);

    var conn_status =  "not connected";
    var message = "";
    var msPerFrame = 20;
    var xMin = 0, xMax = context.canvas.width, yMin = 0, yMax = context.canvas.height;

    // setup world
    var circle_world = new CircleWorld();
    circle_world.xMin = xMin;
    circle_world.yMin = yMin;
    circle_world.xMax = xMax;
    circle_world.yMax = yMax;

    // 'player1' or 'player2'
    var local_player;

    // colors to assign to players
    var PlayerColors = {
        P1: "rgb(254, 159, 26)",
        P2: "rgb(200, 200, 200)"
    }

    // player circle colors
    var myColor = "rgb(0, 0, 0)", oppColor = "rgb(0, 0, 0)";

    // canvas color
    $('#game_canvas').css('background-color', "rgb(0, 0, 0)");
    var inertColor = "rgb(50, 50, 50)";

    // track which sound to play on collision
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

    // initialize the client
    init();
    function init() {
        populateCirclesWP();
        circle_world.collisCallback = collisCallback;
        setInterval(updateGame, msPerFrame);
    }

    // game world step
    function updateGame(){
        circle_world.world_step();
        changeTurns();
        clearCanvas();
        drawMessage();
        drawConnStatus();
        drawCircles();
        drawTrajectory();
    }

    // populate circles with properties
    function populateCirclesWP (){
        var voffset = 50;
        var pieces = 8;
        var r = 0;

        for(var i=0; i<pieces; i++){
            r = Math.sqrt((i + 5) * 40);
            circle_world.circles[i] = new circle_world.CircleWP(xMin + 50, yMin + r + voffset, r, 0, 0, i % 2 == 0 ? PlayerColors.P1 : inertColor);
            voffset += r * 2 + 15;
        }

        voffset = 50;
        r = 0;
        for(var i=0; i<pieces; i++){
            r = Math.sqrt((i + 5) * 40);
            circle_world.circles[i+pieces] = new circle_world.CircleWP(game_canvas.width - xMin - 50, yMin + r + voffset, r, 0, 0, i % 2 == 0 ? PlayerColors.P2 : inertColor);
            voffset += r * 2 + 15;
        }
    }

    // handle websocket events
    ws.onopen = function open() {
        conn_status = "connected";
    };

    // handle close from server
    ws.onclose = function (event) {
        conn_status = "not connected";
    };

    // handle messages from server
    ws.onmessage = function (event) {
        var message_object = JSON.parse(event.data);

        // process remote move
        if(message_object['message'] == 'move'){
            stored_move = message_object;
            if(game_state == StateEnum.WAITING_FOR_REMOTE_MOVE){
                processRemoteMove();
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

    // send game join information
    $("#join").on('click', function (event) {
        var test_object = new Object();
        test_object['message'] = 'join';
        test_object['game'] = $("#text").val();
        var send_object = JSON.stringify(test_object);
        ws.send(send_object);
        $("#join").prop('disabled', true);
        if(conn_status == "connected")
            message = 'Waiting for opponent';
    });

    // set circle velocity and game state
    function processRemoteMove(){
        circle_world.circles[stored_move['move_index']].xv = stored_move['move_xv'];
        circle_world.circles[stored_move['move_index']].yv = stored_move['move_yv'];
        stored_move = "";
        changeGameState(StateEnum.WAITING_FOR_REMOTE_ZERO);
    }


    // send the moved circle to the server
    function sendMove(){
        var circle_message = new Object();
        circle_message['message'] = 'move';
        circle_message['move_index'] = circle_world.markedCircle;
        circle_message['move_xv'] = circle_world.circles[circle_world.markedCircle].xv;
        circle_message['move_yv'] = circle_world.circles[circle_world.markedCircle].yv;
        ws.send(JSON.stringify(circle_message));
    }

    // generate a pastel color
    function pastel(r, g, b){
        return "rgb(" + Math.floor((r+255)/2) + "," + Math.floor((g+255)/2) + "," + Math.floor((b+255)/2) + ")";
    }

    // Releases a circle and sets velocity
    // This method does nothing if the selected ball isn't
    // yours or if it isn't your turn.
   function releaseCircle (){
        if(circle_world.markedCircle > -1 &&
            circle_world.circles[circle_world.markedCircle].color == myColor &&
            game_state == StateEnum.WAITING_FOR_LOCAL_MOVE)
        {
            circle_world.setMarkedVelocity();
            // Indicate the player made a move
            sendMove();
            changeGameState(StateEnum.WAITING_FOR_LOCAL_ZERO);
        }
        circle_world.markedCircle = -1
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

    // set game state and set message appropriately
    function changeGameState(gs){
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

    // Tests if balls are moving but are under a
    // threshold velocity. If they are, changes the
    // turn and sends the position of each
    // ball on the screen to the opponent
    function changeTurns(){
        if (circle_world.high_velocity == 0){
            // Tests if the player made a move and
            // if the moved ball is under a certain velocity
            if(game_state == StateEnum.WAITING_FOR_LOCAL_ZERO)
            {
                changeGameState(StateEnum.WAITING_FOR_REMOTE_MOVE);
                if(stored_move)
                    processRemoteMove();
            }
            else{
                if(game_state == StateEnum.WAITING_FOR_REMOTE_ZERO)
                    changeGameState(StateEnum.WAITING_FOR_LOCAL_MOVE);
            }
        }
    }

    // mouse and touchscreen events to track position
    function mousePressed(e){
        circle_world.mPressed = true;
        circle_world.mouseX = e.clientX - game_canvas.offsetLeft;
        circle_world.mouseY = e.clientY - game_canvas.offsetTop;
    }

    // mouse and touchscreen events to track position
    function touchStart(e){
        e.preventDefault();
        circle_world.mPressed = true;
        circle_world.mouseY = e.targetTouches[0].clientY - game_canvas.offsetTop;
    }

    // mouse and touchscreen events to track position
    function mouseReleased(e){
        circle_world.mPressed = false;
        releaseCircle();
    }

    // mouse and touchscreen events to track position
    function touchEnd(e){
        circle_world.mPressed = false;
        releaseCircle();
    }

    // mouse and touchscreen events to track position
    function mouseMoved(e){
        if (circle_world.mPressed) {
            circle_world.mouseX = e.clientX - game_canvas.offsetLeft;
            circle_world.mouseY = e.clientY - game_canvas.offsetTop;
        }
    }

    // mouse and touchscreen events to track position
    function touchMove(e){
        e.preventDefault();
        if (circle_world.mPressed) {
            circle_world.mouseX = e.targetTouches[0].clientX - game_canvas.offsetLeft;
            circle_world.mouseY = e.targetTouches[0].clientY - game_canvas.offsetTop;
        }
    }

    // clear drawing from canvas
    function clearCanvas(){
        context.clearRect(xMin, yMin, xMax, yMax);
    }

    // draw messages from the server
    function drawMessage(){
        if(message)
        {
            // Write the message
            if(game_state == StateEnum.WAITING_FOR_LOCAL_MOVE ||
                game_state == StateEnum.WAITING_FOR_LOCAL_ZERO)
                context.fillStyle = myColor;
            else if(game_state == StateEnum.WAITING_FOR_REMOTE_MOVE ||
                game_state == StateEnum.WAITING_FOR_REMOTE_ZERO)
                context.fillStyle = oppColor;
            else
                context.fillStyle = "rgb(49, 245, 88)";

            context.font = '15pt Courier New';
            context.textBaseline = 'middle';
            context.textAlign = 'center';
            context.fillText(message,  game_canvas.width / 2, game_canvas.height / 2);
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

    // mark circles with some information (useful for debugging)
    function drawCircleID(){
        for (var i=0; i<circle_world.circles.length; i++){
            context.fillStyle = "black";
            context.font = '12pt Calibri';
            context.fillText(i.toString() + ' x:' + Math.round(circle_world.circles[i].xv) + ' y:' + Math.round(circle_world.circles[i].yv), circle_world.circles[i].x, circle_world.circles[i].y);
        }
    }

    // draw all circles on the canvas
    function drawCircles() {
        for (var i = 0; i < circle_world.circles.length; i++) {
            context.fillStyle = circle_world.circles[i].color;
            context.beginPath();
            context.arc(circle_world.circles[i].x, circle_world.circles[i].y, circle_world.circles[i].r, 0, 2*Math.PI);
            context.closePath();
            context.fill();
        }
    }

    // draw a line that indicates the velocity to be applied to the circle
    // the maximum extent of the line indicates the point at which maximum velocity is applied
    function drawTrajectory(){
        if(circle_world.mPressed && circle_world.mouseX && circle_world.markedCircle > -1){
            var originX = circle_world.circles[circle_world.markedCircle].x;
            var originY = circle_world.circles[circle_world.markedCircle].y;
            var dist = distPoints(circle_world.mouseX, circle_world.mouseY, originX, originY);
            var line_dist = Math.min( circle_world.shotMaxSpd / circle_world.shotSpdAdjust, dist);
            var x_unitv = (circle_world.mouseX - originX) / dist;
            var y_unitv = (circle_world.mouseY - originY) / dist;
            var finalX = x_unitv * line_dist + originX;
            var finalY = y_unitv * line_dist + originY;
            if(Math.abs(circle_world.mouseX-originX) > 0 || Math.abs(circle_world.mouseY-originY)>0) {
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
