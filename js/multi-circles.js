/**
 * @author Kevin Glanville
 */


    // initialize vars on load
$(function() {
    $("#status").html('Not connected');
    $("#close").prop('disabled', true);
    $("#send").prop('disabled', true);
    $("#url").val("ws://localhost:8080");
    // declare ws up here so we can swap it out
    var ws;

    // clicking 'open' creates a new socket at the url entered
    $("#open").on('click', function (event) {
        ws = new WebSocket($("#url").val());

        // swap buttons around when socket is open
        ws.onopen = function open() {
            conn_status = "Connected";
            $("#status").html('Connected');
            $("#close").prop('disabled', false);
            $("#send").prop('disabled', false);
            $("#open").prop('disabled', true);
        };

        ws.onclose = function close() {
            conn_status = "Not Connected";
            $("#status").html('Not connected');
            $("#close").prop('disabled', true);
            $("#send").prop('disabled', true);
            $("#open").prop('disabled', false);
        };

        ws.onmessage = function (event) {
            try{
                var message_object = JSON.parse(event.data);
                circles[message_object['circle']].xv = message_object['xv'];
                circles[message_object['circle']].yv = message_object['yv'];
            }
            catch(exception){

            }
            message += event.data + "     ";
        };

        $("#close").on('click', function (event) {
            ws.close();
        });

        $("#send").on('click', function (event) {
            var test_object = new Object();
            test_object['message'] = $("#text").val();
            var send_object = JSON.stringify(test_object);
            ws.send(send_object);
        });

    });

    // circle handling
    var canvas1 = document.getElementById("canvas1");
    var context = canvas1.getContext("2d");
    context.canvas.width  = 800;
    context.canvas.height = 400;
    document.addEventListener("mousedown", mousePressed);
    document.addEventListener("mouseup", mouseReleased);
    document.addEventListener("mousemove", mouseMoved);

    var conn_status =  "Not connected";
    var message = "";

    var mousePoints = [], circles = [], collisPairs = [];
    // look into changing updates to request_anim_frame rather than framerate (more consistent physics across clients?)
    var msPerFrame = 20;
    var circleCount = 5;
    var xMin = 0, xMax = context.canvas.width, yMin = 0, yMax = context.canvas.height;
    var mPressed = false, mReleased = true, circleMarked = false;
    var markedCircle;
    var releaseSpeedMultiplier = 4, shotMaxSpd=xMax*0.1, shotMinSpd = 1, dragVal = 0.01, gravityVal = 0, floorDistBuffer = 0,
        velBuffer = 1, wallCoR = 0.8, floorGravityBuffer = 1, grabCircMassMult = 1000;
    var cursorOffset = -15;
    var mouseVelPoints = 10; //number of cursor points to use in determining circle velocity when released
    var gravity = true, drag = true, ceiling = true;
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
        var offset = 0;
        var r = 0;
        var randColor;
        for(var i=0; i<7; i++){
            randColor = randomMixedColor(200, 200, 200);
            r = xMax / (25 * ( i/3 +1 ) );
            circles[i] = new CircleWP(xMin + r + offset, yMax/2, r, 0, 0, "rgb(" +
            Math.floor(randColor[0]) +","+ Math.floor(randColor[1]) +"," + Math.floor(randColor[2]) +")");
            offset += r * 2 + 15;
        }
    }

    function randomMixedColor(r, g, b){
        var red = Math.random()*255,
            blue = Math.random()*255,
            green = Math.random()*255;
        return [(red + r)/2, (blue + b)/2, (green + g)/2];
    }

    function populateCircles() {
        for (var i = 0; i < circleCount; i++) {
            circles[i] = new Circle();
        }
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

    function releaseCircle(){
        if(markedCircle > -1){
            setMarkedVelocity();
            var circle_message = new Object();
            try{

                circle_message['circle'] = markedCircle;
                circle_message['xv'] = circles[markedCircle].xv;
                circle_message['yv'] = circles[markedCircle].yv;
                ws.send(JSON.stringify(circle_message));
            }
            catch(exception){

            }
            circles[markedCircle].m = 4/3 * Math.PI * Math.pow( circles[markedCircle].r, 3);
            circles[markedCircle].marked = false;
            circleMarked = false;
            markedCircle = -1;
        }
    }

    function setMarkedVelocity(){
        var mouseX = mousePoints[mousePoints.length-1].x;
        var mouseY = mousePoints[mousePoints.length-1].y;
        var originX = mousePoints[0].x;
        var originY = mousePoints[0].y;

        if( Math.abs(mouseX-originX) > 0 || Math.abs(mouseY-originY)>0) {
            var dist = distPoints(mouseX, mouseY, originX, originY);
            var xDiffUnit = (mouseX - originX) / dist;
            var yDiffUnit = (mouseY - originY) / dist;
            circles[markedCircle].xv = xDiffUnit * (shotMaxSpd - shotMinSpd) * dist / Math.sqrt(Math.pow(xMax, 2) + Math.pow(yMax, 2));
            circles[markedCircle].yv = yDiffUnit * (shotMaxSpd - shotMinSpd) * dist / Math.sqrt(Math.pow(xMax, 2) + Math.pow(yMax, 2));
        }
    }

    function calcAvgProp(arr, lastDigits, prop){
        var sum = 0;
        var propVal;
        for (var i=arr.length-2; i>Math.max(0, arr.length-(lastDigits-1)); i--){
            propVal = arr[i+1][prop];
            sum += arr[i+1][prop] - arr[i][prop];
        }
        return sum/lastDigits;
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

    function logFramePoints(){
        if (mPressed){
            logPoint(mousePoints[mousePoints.length-1].x, mousePoints[mousePoints.length-1].y);
        }
    }

    function markCircle() {
        if (mPressed && !circleMarked) {
            for (var i=0; i<circles.length; i++){
                var dist = distPoints(circles[i].x, circles[i].y, mousePoints[mousePoints.length-1].x, mousePoints[mousePoints.length-1].y);
                if (dist < circles[i].r){
                    circles[i].marked = true;
                    circles[i].m = grabCircMassMult * 4/3 * Math.PI * Math.pow( circles[i].r, 3);
                    circleMarked = true;
                    markedCircle = i;
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

    function dragAndGravity(){
        for(var i=0; i<circles.length; i++){
            if (drag){
                circles[i].xv *= (1-dragVal);
                circles[i].yv *= (1-dragVal);
            }

            if (gravity & yMax - (circles[i].y + circles[i].r) > floorDistBuffer){
                var circleDistFromFloor = yMax - (circles[i].y + circles[i].r);
                var stepFromFloor = Math.abs( circleDistFromFloor);
                circles[i].yv += ( gravityVal * Math.min( 1, Math.abs(circleDistFromFloor)/floorGravityBuffer ) );
            }
        }
    }

    function gravityToggle(){
        gravity = !gravity;
    }

    function dragToggle(){
        drag = !drag;
    }

    function drawmessage(){
        context.fillStyle = "white";
        context.fillText(message, 20, 20);
    }

    function drawConnStatus(){
        context.fillStyle = "white";
        context.fillText(conn_status, 10, 10);
    }
    function drawCircleID(){
        for (var i=0; i<circles.length; i++){
            context.fillStyle = "white";
            context.fillText(i.toString(), circles[i].x, circles[i].y);
            //context.fillText(circles[i].yv, circles[i].x, circles[i].y);
            //context.fillText(circles[i].xv, circles[i].x, circles[i].y + 10);
        }
    }

    function mouseInteract(){
        logFramePoints();
        markCircle();
        handleMarkedCircle();
    }

    function sizeCanvas(){
        context.clearRect(xMin, yMin, xMax, yMax);
        /*
         context.canvas.width  = window.innerWidth - canvas1.offsetLeft;
         context.canvas.height = window.innerHeight-canvas1.offsetTop;
         xMax = window.innerWidth - canvas1.offsetLeft;
         yMax = window.innerHeight-canvas1.offsetTop;
         */
    }

    function updateCircles(){
        sizeCanvas();
        drawCircles(circles, context);
        drawConnStatus();
        drawmessage();
        drawCircleID();
        dragAndGravity();
        incPos(circles);
        wallCollision(circles, xMin, xMax, yMin, yMax, wallCoR, ceiling);
        collisions(circles, collisPairs);
        mouseInteract();
    }
});
