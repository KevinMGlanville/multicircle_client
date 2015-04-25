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
    // clicking 'open' creates a new socket at the url entered
    ws = new WebSocket(websocket_url);

    // swap buttons around when socket is open
    ws.onopen = function open() {
        conn_status = "Connected";
    };

    ws.onclose = function (event) {
        conn_status = "Not connected";
    };

    ws.onmessage = function (event) {
        var message_object = JSON.parse(event.data);
        if(message_object['message'] == 'move'){
            for(var i=0; i<circles.length; i++){
                circles[message_object['move_index']].xv = message_object['move_xv'];
                circles[message_object['move_index']].yv = message_object['move_yv'];
                //circles[i].x = message_object['circles'][i].x;
                //circles[i].y = message_object['circles'][i].y;
            }
        }

        message = event.data ;
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

    var conn_status =  "Not connected";
    var message = "";
    var greenScore = 0;
    var redScore = 0;
    var turn = 0;

    var circles = [], collisPairs = [];
    var mouseX = 0, mouseY = 0;
    var msPerFrame = 20;
    var circleCount = 5;
    var xMin = 0, xMax = context.canvas.width, yMin = 0, yMax = context.canvas.height;
    var mPressed = false, mReleased = true, circleMarked = false;
    var markedCircle;
    var shotMaxSpd = xMax / 75, shotSpdAdjust = 0.05, dragVal = 0.01, gravityVal = 0, floorDistBuffer = 0,
        wallCoR = 0.8;
    var drag = true, ceiling = true;

    // Controls if it is currently this player's turn
    var myTurn = true;

    // Keeps track of if the active player made a move
    var madeMove = false;

    // The minimum speed a ball can move, used to change turns
    var minimumVelocity = 0.05;

    // current highest velocity circle
    var high_velocity = 0;

    var audio_counter = 1;

    //var myColor = "rgb(255,105,97)";
    //var oppColor = "rgb(96,130,182)";
    //var myColor = pastel(240, 240, 20);
    //var oppColor = pastel(0, 255, 255);
    //$('#canvas1').css('background-color', pastel(0, 0, 0));

    var myColor = "rgb(254, 159, 26)";
    //var oppColor = "rgb(0, 202, 53)";
    var oppColor = "rgb(200, 200, 200)";
    var inertColor = "rgb(50, 50, 50)";
    $('#canvas1').css('background-color', "rgb(0, 0, 0)");

    // The ball object that is currently marked
    // Can be used to get the color of the selected ball
    var selectedBall;

    // The number of animation loops to display messages
    var messageDisplayTime = 200;

    // The number of animation loops the message has been displayed
    var framesMessageDisplayed = 0;


    init();

    function init() {
        populateCirclesWP();
        setInterval(updateCircles, msPerFrame);
    }

    // game world step
    function updateCircles(){
        clearCanvas();
        drawConnStatus();
        drawmessage();
        applyDrag();
        incPos(circles);
        wallCollision(circles, xMin, xMax, yMin, yMax, wallCoR, ceiling);
        collisions(circles, collisPairs, collisCallback);
        mouseInteract();
        clipVelocities();
        changeTurns();
        drawTrajectory();
        drawCircles(circles, context);
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
            circles[i] = new CircleWP(xMin + 50, yMin + r + voffset, r, 0, 0, i % 2 == 0 ? myColor : inertColor);
            voffset += r * 2 + 15;
        }

        voffset = 50;
        r = 0;
        for(var i=0; i<pieces; i++){
            r = Math.sqrt((i + 5) * 40);
            circles[i+pieces] = new CircleWP(canvas1.width - xMin - 50, yMin + r + voffset, r, 0, 0, i % 2 == 0 ? oppColor : inertColor);
            voffset += r * 2 + 15;
        }

    }

    function pastel(r, g, b){
        return "rgb(" + Math.floor((r+255)/2) + "," + Math.floor((g+255)/2) + "," + Math.floor((b+255)/2) + ")";
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
        mPressed = true;
        mReleased = false;
        mouseX = e.targetTouches[0].clientX - canvas1.offsetLeft;
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
        if(markedCircle > -1 && myTurn && myColor === selectedBall.color && madeMove == false){
            setMarkedVelocity();
            // Indicate the player made a move

            madeMove = true;

            send_move();

            circleMarked = false;
            markedCircle = -1;
        }
        //only for local game testing
        else if(markedCircle > -1 && !myTurn && oppColor === selectedBall.color && madeMove == false){
            setMarkedVelocity();
            // Indicate the player made a move
            madeMove = true;
            send_move();
            markedCircle = -1;
        }
        // unmark the ball if it didn't belong to the player trying to move it
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
                    selectedBall = circles[i];
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
    function drawmessage(){

        // Check if the message should still be displayed
        if(framesMessageDisplayed <= messageDisplayTime)
        {
            // Write the message
            context.fillStyle = "black";
            context.font = '30pt Calibri';
            context.textBaseline = 'middle';
            context.textAlign = 'center';
            context.fillText(message,  canvas1.width / 2, canvas1.height / 2);

            // Increase the frame count
            framesMessageDisplayed++;
        }
        else
        {
            // Reset the count and message
            framesMessageDisplayed = 0;
            message = "";
        }
    }

    // draw status of websocket connection
    function drawConnStatus(){
        context.fillStyle = "black";
        context.font = '12pt Calibri';
        context.fillText(conn_status, 55, 15);
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
        // Tests if the player made a move and
        // if the moved ball is under a certain velocity
        if(madeMove && myTurn)
        {
            if (high_velocity == 0){

                console.log("zeroed");
                //All the balls passed the minimum test, pass the turn to the other player
                myTurn = false;
                madeMove = false;
                message = "Turn ended";
                framesMessageDisplayed = 0;

                //Send the position of all the balls
                for (var j = 0; j < circles.length; j++)
                {
                    //TODO: Waiting for object message structure
                }

                turn++;
            }
        }
        //only for local game
        else if(madeMove && !myTurn)
        {
            // Check if all balls velocity are under
            // a given minimum velocity
            for (var i = 0; i < circles.length; i++)
            {
                // If a ball is under a given minimum velocity, stop it
                if((Math.abs(circles[i].xv) <= minimumVelocity) && (Math.abs(circles[i].yv) <= minimumVelocity))
                {
                    circles[i].xv = 0;
                    circles[i].yv = 0;
                }

                // If a ball isn't under the given minimum velcity, return
                if(!(Math.abs(circles[i].xv) <= minimumVelocity) && !(Math.abs(circles[i].yv) <= minimumVelocity))
                {
                    return;
                }
            }

            //All the balls passed the minimum test, pass the turn to the other player
            myTurn = true;
            madeMove = false;
            message = "Turn is over!";

            //Send the position of all the balls
            for (var j = 0; j < circles.length; j++)
            {
                //TODO: Waiting for object message structure
            }

            turn++;

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
        if (c1.color != c2.color && c1.color != inertColor && c2.color != inertColor)
            colorSwap = true;
        if(colorSwap){
            if(turn % 2 == 0) {
                collisPair.c1.color = myColor;
                collisPair.c2.color = myColor;
            }
            else{
                collisPair.c1.color = oppColor;
                collisPair.c2.color = oppColor;
            }
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
