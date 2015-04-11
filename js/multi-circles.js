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
            circles[message_object['circle']].xv = message_object['xv'];
            circles[message_object['circle']].yv = message_object['yv'];
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

    var mousePoints = [], circles = [], collisPairs = [];
    // look into changing updates to request_anim_frame rather than framerate (more consistent physics across clients?)
    var msPerFrame = 20;
    var circleCount = 5;
    var xMin = 0, xMax = context.canvas.width, yMin = 0, yMax = context.canvas.height;
    var mPressed = false, mReleased = true, circleMarked = false;
    var markedCircle;
    var shotMaxSpd=xMax*0.05, shotMinSpd = 1, dragVal = 0.01, gravityVal = 0, floorDistBuffer = 0,
        wallCoR = 0.8, floorGravityBuffer = 1, grabCircMassMult = 1000;
    var gravity = true, drag = true, ceiling = true;

    // Controls if it is currently this player's turn
    var myTurn = true;

    // Keeps track of if the active player made a move
    var madeMove = false;

    // The minimum speed a ball can move, used to change turns
    var minimumVelocity = 0.07;

    var myColor = "rgb(255,105,97)"
    var oppColor = "rgb(96,130,182)"

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

    function Circle() {
        this.minSize = 10;
        this.x = Math.random() * xMax;
        this.y = Math.random() * yMax;
        this.r = Math.random() * (xMax + yMax) / 100 + this.minSize;
        this.xv = ( Math.random() > 0.5 ? 1 : (-1) ) * Math.random() * (xMax + yMax) / 150;
        this.yv = ( Math.random() > 0.5 ? 1 : (-1) ) * Math.random() * (xMax + yMax) / 150;
        this.m = 4/3 * Math.PI * Math.pow( this.r, 3);
        this.color = "#" + (Math.random().toString(16) + '000000').slice(2, 8) + "";
        this.marked = false;
    }

    function CircleWP(x, y, r, xv, yv, color) {
        this.minSize = 10;
        this.x = x;
        this.y = y;
        this.r = r;
        this.xv = xv;
        this.yv = yv;
        this.m = 4/3 * Math.PI * Math.pow( this.r, 3);
        this.color = color;
        this.marked = false;
    }

    function populateCirclesWP(){
        var offset = 100;
        var r = 0;
        var randColor;
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
        logPoint(e.clientX - canvas1.offsetLeft, e.clientY - canvas1.offsetTop);
    }

    function mouseReleased(e){
        mPressed = false;
        mReleased = true;
        releaseCircle();
        clearArr(mousePoints);
    }

    // Releases a circle and sends it flying.
    // This method does nothing if the selected ball isn't
    // yours or if it isn't your turn.
    function releaseCircle(){
        if(markedCircle > -1 && myTurn && myColor === selectedBall.color && madeMove == false){
            setMarkedVelocity();
            // Indicate the player made a move

            madeMove = true;

            var circle_message = new Object();
            circle_message['message'] = 'move';
            circle_message['circle'] = markedCircle;
            circle_message['xv'] = circles[markedCircle].xv;
            circle_message['yv'] = circles[markedCircle].yv;
            ws.send(JSON.stringify(circle_message));

            circles[markedCircle].marked = false;
            circleMarked = false;
            markedCircle = -1;
        }
        //only for local game testing
        else if(markedCircle > -1 && !myTurn && oppColor === selectedBall.color && madeMove == false){
            setMarkedVelocity();
            // Indicate the player made a move

            madeMove = true;

            var circle_message = new Object();
            circle_message['message'] = 'move';
            circle_message['circle'] = markedCircle;
            circle_message['xv'] = circles[markedCircle].xv;
            circle_message['yv'] = circles[markedCircle].yv;
            ws.send(JSON.stringify(circle_message));

            circles[markedCircle].marked = false;
            circleMarked = false;
            markedCircle = -1;
        }
        // Unmark the ball if it didn't belong to the player trying to move it
        circleMarked = false;
    }

    function setMarkedVelocity(){
        var mouseX = mousePoints[mousePoints.length-1].x;
        var mouseY = mousePoints[mousePoints.length-1].y;
        var originX = circles[markedCircle].x;
        var originY = circles[markedCircle].y;

        if( Math.abs(mouseX-originX) > 0 || Math.abs(mouseY-originY)>0) {
            var dist = distPoints(mouseX, mouseY, originX, originY);
            var xDiffUnit = (mouseX - originX) / dist;
            var yDiffUnit = (mouseY - originY) / dist;
            circles[markedCircle].xv = xDiffUnit * (shotMaxSpd - shotMinSpd) * dist / Math.sqrt(Math.pow(xMax, 2) + Math.pow(yMax, 2));
            circles[markedCircle].yv = yDiffUnit * (shotMaxSpd - shotMinSpd) * dist / Math.sqrt(Math.pow(xMax, 2) + Math.pow(yMax, 2));
        }
    }

    function mouseMoved(e){
        if (mPressed) {
            logPoint(e.clientX - canvas1.offsetLeft, e.clientY - canvas1.offsetTop);
            if (circleMarked){
                handleMarkedCircle();
            }
        }
    }

    function logPoint(x, y){
        mousePoints.push(new Point(x, y));
    }

    function markCircle() {
        if (mPressed && !circleMarked) {
            for (var i=0; i<circles.length; i++){
                var dist = distPoints(circles[i].x, circles[i].y, mousePoints[mousePoints.length-1].x, mousePoints[mousePoints.length-1].y);
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
            //circles[markedCircle].x = mousePoints[mousePoints.length-1].x;
            //circles[markedCircle].y = mousePoints[mousePoints.length-1].y;
            //setMarkedVelocity();
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
            //console.log(ballColor);

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

    // Tests if balls are moving but are under a
    // threshold velocity. If they are, changes the 
    // turn and sends the position of each
    // ball on the screen to the opponent
    function changeTurns(){
        // Tests if the player made a move and
        // if the moved ball is under a certain velocity
        if(madeMove && myTurn)
        {
            // Check if all balls velocity are under
            // a given minimum velocity
            for (var i = 0; i < circles.length; i++)
            {
                // If a ball isn't under the given minimum velcity, return
                if(!(Math.abs(circles[i].xv) <= minimumVelocity) && !(Math.abs(circles[i].yv) <= minimumVelocity))
                {
                    return;
                }
            }

            //Stop all balls completely
            for (var z = 0; z < circles.length; z++){

                circles[z].xv = 0;
                circles[z].yv = 0;

            }

            //All the balls passed the minimum test, pass the turn to the other player
            myTurn = false;
            madeMove = false;
            message = "Turn is over!";

            //Send the position of all the balls
            for (var j = 0; j < circles.length; j++)
            {
                //TODO: Waiting for object message structure
            }

            turn++;

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

    function updateCircles(){
        clearCanvas();
        drawCircles(circles, context);
        drawConnStatus();
        drawPlayerScores();
        drawmessage();
        //drawCircleID();
        applyDrag();
        incPos(circles);
        wallCollision(circles, xMin, xMax, yMin, yMax, wallCoR, ceiling);
        collisions(circles, collisPairs, collisCallback);
        mouseInteract();
        // Check if it's time to change turns
        changeTurns();
    }
});
