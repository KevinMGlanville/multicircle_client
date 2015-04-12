/**
 * @author Kevin Glanville
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
        test_object['message'] = $("#text").val();
        var send_object = JSON.stringify(test_object);
        ws.send(send_object);
    });

    // circle handling
    var canvas1 = document.getElementById("canvas1");
    var context = canvas1.getContext("2d");
    context.canvas.width  = 800;
    context.canvas.height = 500;
    document.addEventListener("mousedown", mousePressed);
    document.addEventListener("mouseup", mouseReleased);
    document.addEventListener("mousemove", mouseMoved);

    var conn_status =  "Not connected";
    var message = "";
    var greenScore = 0;
    var redScore = 0;
    var turn = 0;

    var circles = [], collisPairs = [];
    var mouseX = 0, mouseY = 0;
    // look into changing updates to request_anim_frame rather than framerate (more consistent physics across clients?)
    var msPerFrame = 20;
    var circleCount = 5;
    var xMin = 0, xMax = context.canvas.width, yMin = 0, yMax = context.canvas.height;
    var mPressed = false, mReleased = true, circleMarked = false;
    var markedCircle;
    var shotMaxSpd = xMax / 75, shotSpdAdjust = 0.03, dragVal = 0.01, gravityVal = 0, floorDistBuffer = 0,
        wallCoR = 0.8;
    var drag = true, ceiling = true;

    // Controls if it is currently this player's turn
    var myTurn = true;

    // Keeps track of if the active player made a move
    var madeMove = false;

    // The minimum speed a ball can move, used to change turns
    var minimumVelocity = 0.1;

    // current highest velocity circle
    var high_velocity = 0;

    var audio_counter = 1;

    //var myColor = "rgb(255,105,97)";
    //var oppColor = "rgb(96,130,182)";
    var myColor = pastel(240, 240, 20);
    var oppColor = pastel(0, 255, 255);
    $('#canvas1').css('background-color', pastel(150, 40, 150));

    // The ball object that is currently marked
    // Can be used to get the color of the selected ball
    var selectedBall;

    // The number of animation loops to display messages
    var messageDisplayTime = 200;

    // The number of animation loops the message has been displayed
    var framesMessageDisplayed = 0;


    init();

    function init() {
        //populateCircles();
        populateCirclesWP();
        setInterval(updateCircles, msPerFrame);
    }

    function Point(x, y){
        this.x = x;
        this.y = y;
    }

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
        var offset = 100;
        var r = 0;
        for(var i=0; i<5; i++){
            //randColor = randomMixedColor(0, 0, 255);
            r = xMax / (25 * ( i/3 +1 ) );
            circles[i] = new CircleWP(xMin + 50, yMin + r + offset, r, 0, 0, myColor);
            offset += r * 2 + 15;
        }
        offset = 100;
        r = 0;
        for(i=5; i < 10; i++){
            //randColor = randomMixedColor(0, 0, 255);
            r = xMax / (25 * ( (i-5)/3 +1 ) );
            circles[i] = new CircleWP(canvas1.width - xMin - 50, xMin + r + offset , r, 0, 0, oppColor);
            offset += r * 2 + 15;
        }
    }

    function pastel(r, g, b){
        return "rgb(" + Math.floor((r+255)/2) + "," + Math.floor((g+255)/2) + "," + Math.floor((b+255)/2) + ")";
    }

    function randomMixedColor(r, g, b){
        var red = Math.random()*255,
            blue = Math.random()*255,
            green = Math.random()*255;
        //return [(red + r)/2, (blue + b)/2, (green + g)/2];
        return [(r)/2, (b)/2, (g)/2];

    }

    function mousePressed(e){
        mPressed = true;
        mReleased = false;
        mouseX = e.clientX - canvas1.offsetLeft;
        mouseY = e.clientY - canvas1.offsetTop;
    }

    function mouseReleased(e){
        mPressed = false;
        mReleased = true;
        releaseCircle();
    }

    // Releases a circle and sends it flying.
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
        // Unmark the ball if it didn't belong to the player trying to move it
        circleMarked = false;
    }

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

    function send_move(){
        var circle_message = new Object();
        circle_message['message'] = 'move';
        circle_message['move_index'] = markedCircle;
        circle_message['move_xv'] = circles[markedCircle].xv;
        circle_message['move_yv'] = circles[markedCircle].yv;
        //circle_message['circles'] = circles;
        ws.send(JSON.stringify(circle_message));
    }

    function mouseMoved(e){
        if (mPressed) {
            mouseX = e.clientX - canvas1.offsetLeft;
            mouseY = e.clientY - canvas1.offsetTop;
            if (circleMarked){
                handleMarkedCircle();
            }
        }
    }

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

    function handleMarkedCircle(){
        if (markedCircle > -1){
        }
    }

    function applyDrag(){
        for(var i=0; i<circles.length; i++){
            if (drag){
                circles[i].xv *= (1-dragVal);
                circles[i].yv *= (1-dragVal);
            }
        }
    }

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

    function drawConnStatus(){
        context.fillStyle = "black";
        context.font = '12pt Calibri';
        context.fillText(conn_status, 55, 15);
    }

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
    function drawCircleID(){
        for (var i=0; i<circles.length; i++){
            context.fillStyle = "black";
            context.font = '12pt Calibri';
            context.fillText(i.toString() + ' x:' + Math.round(circles[i].xv) + ' y:' + Math.round(circles[i].yv), circles[i].x, circles[i].y);
             //context.fillText(circles[i].yv, circles[i].x, circles[i].y);
            //context.fillText(circles[i].xv, circles[i].x, circles[i].y + 10);
        }
    }
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
        handleMarkedCircle();
    }

    function clearCanvas(){
        context.clearRect(xMin, yMin, xMax, yMax);
    }

    function collisCallback(collisPair){
        if(audio_counter >4) audio_counter =1;
        document.getElementById("audio" + audio_counter++).play();
        //Change color to gray when ever a collision occurs.  This
        //logic will change when we know what colors turn it is.
        //Then we just turn both balls to the player who's turn
        //it is color
        if(turn % 2 == 0) {
            collisPair.c1.color = myColor;
            collisPair.c2.color = myColor;
        }
        else{
            collisPair.c1.color = oppColor;
            collisPair.c2.color = oppColor;
        }
    }

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
                context.strokeStyle = "rgb(100, 100, 100)";
                context.lineWidth=10;
                context.lineCap = "round";
                context.stroke();
            }
        }
    }

    function updateCircles(){
        clearCanvas();
        drawConnStatus();
        //drawPlayerScores();
        drawmessage();
        //drawCircleID();
        applyDrag();
        incPos(circles);
        wallCollision(circles, xMin, xMax, yMin, yMax, wallCoR, ceiling);
        collisions(circles, collisPairs, collisCallback);
        mouseInteract();
        // Check if it's time to change turns
        changeTurns();
        drawTrajectory();
        drawCircles(circles, context);
    }
});
