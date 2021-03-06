/**
 * Function library for circle calculations, including increment position and collision detection and handling
 *
 * @author Kevin Glanville
 */

// clear an array
function clearArr(arr) {
    while (arr.length > 0) {
        arr.pop();
    }
}

// calculate the distance between two points
function distPoints(x1, y1, x2, y2) {
    return Math.sqrt( Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2) );
}

// increment the positions of objects in an array with x, y, xv, and yv values
function incPos(circles) {
    for (var i = 0; i < circles.length; i++) {
        circles[i].x += circles[i].xv;
        circles[i].y += circles[i].yv;
    }
}

// increment x and y positions of two objects as a fraction of their velocity
function partialStep(c1, c2, t){
    c1.x = c1.x + c1.xv * t;
    c1.y = c1.y + c1.yv * t;
    c2.x = c2.x + c2.xv * t;
    c2.y = c2.y + c2.yv * t;
}

// check for collisions between all circles (expensive), then check for collisions between collisions (even more expensive)
function collisions(circles, collisPairs, collision){
    clearArr(collisPairs);
    populateCollis(circles, collisPairs, collision);
    if(collisPairs.length>0){
        sortCollisions(collisPairs);
        handleCollisZero(collisPairs);
    }

    while(collisPairs.length > 0){
        clearArr(collisPairs);
        populateCollis(circles, collisPairs, collision);
        if(collisPairs.length>0){
            sortCollisions(collisPairs);
            handleCollisZero(collisPairs);
        }
    }
}

// sort collisions so they can be handled in order
function sortCollisions(collisPairs){
    collisPairs.sort(
        function compare(a, b) {
            if (a.t<b.t)
                return -1;
            if (a.t>b.t)
                return 1;
            return 0;
        }
    );
}

// handle the first collision
function handleCollisZero(collisPairs) {
    setCollisPos( collisPairs[0].c1, collisPairs[0].c2, collisPairs[0].t );
    setCollisVel(collisPairs[0].c1, collisPairs[0].c2);
    // move circles to their position at the end of the increment
    partialStep(collisPairs[0].c1, collisPairs[0].c2, 1-collisPairs[0].t);
}

// check for and handle collisions with the limits
function wallCollision(circles, xL, xH, yL, yH, wallCoR, ceiling) {

    for (var i = 0; i < circles.length; i++) {
        if (circles[i].x + circles[i].r >= xH){
            circles[i].xv = -Math.abs( circles[i].xv ) * wallCoR;
            circles[i].x = xH - circles[i].r;
        }
        if (circles[i].x - circles[i].r <= xL){
            circles[i].xv = Math.abs( circles[i].xv ) * wallCoR;
            circles[i].x = xL + circles[i].r;
        }
        if (circles[i].y + circles[i].r >= yH){
            circles[i].counter = 0;
            circles[i].yv = -Math.abs( circles[i].yv ) * wallCoR;
            circles[i].y = yH - circles[i].r;
        }
        if (ceiling && circles[i].y - circles[i].r <= yL){
            circles[i].yv = Math.abs( circles[i].yv ) * wallCoR;
            circles[i].y = yL + circles[i].r;
        }
    }
}

// check for collisions between all circles
function populateCollis(circles, collisPairs, collision) {
    for (var i = 0; i < circles.length; i++) {
        for (var j = i + 1; j < circles.length; j++){
            var dist = distPoints(circles[i].x, circles[i].y, circles[j].x, circles[j].y);
            var sumR = circles[i].r + circles[j].r;
            if ( dist < sumR) {
                collisPairs.push( new CollisPair( circles[i], circles[j], calcTimeStepCollis(circles[i], circles[j] ) ) );
                collision(collisPairs[collisPairs.length-1]);
            }
        }
    }
}

// stores collision circles and time
function CollisPair( c1, c2, t) {
    this.c1 = c1;
    this.c2 = c2;
    this.t = t;
}

// calculate the partial step of the collision (between 0 and 1)
function calcTimeStepCollis(c1, c2) {

    var t;
    var collisDist = c1.r + c2.r;

    var vx1f = c1.xv - c2.xv;
    var vy1f = c1.yv - c2.yv;

    var x10 = c1.x - c1.xv;
    var y10 = c1.y - c1.yv;

    var x20 = c2.x - c2.xv;
    var y20 = c2.y - c2.yv;

    var x10f = x10 - x20;
    var y10f = y10 - y20;

    var a = vx1f*vx1f + vy1f*vy1f;
    var b = 2 * x10f * vx1f + 2 * y10f * vy1f;
    var c = x10f*x10f + y10f*y10f - collisDist*collisDist;

    var t1 = Math.abs( ( -b + Math.sqrt( b*b - 4 * a * c ) ) / (2 * a) );
    var t2 = Math.abs( ( -b - Math.sqrt( b*b - 4 * a * c ) ) / (2 * a) );

    t = Math.min(t1, t2);

    return t;
}

// set the circles to their positions at the time of collision
function setCollisPos(c1, c2, timeStep) {
    c1.x = c1.x - c1.xv * ( 1 - timeStep );
    c1.y = c1.y - c1.yv * (1 - timeStep );
    c2.x = c2.x - c2.xv * ( 1 - timeStep );
    c2.y = c2.y - c2.yv * ( 1 - timeStep );
}

// set the circles to the velocity resulting from their collision
function setCollisVel(c1, c2) {
    var dist = Math.sqrt( Math.pow(c1.x - c2.x , 2) + Math.pow(c1.y - c2.y, 2 ) );
    var normalX = ( c2.x - c1.x ) / dist;
    var normalY = ( c2.y - c1.y ) / dist;

    var tangX = normalY;
    var tangY = -normalX;

    var velNormC1 = c1.xv * normalX + c1.yv * normalY;
    var velNormC2 = c2.xv * (-normalX) + c2.yv * (-normalY);

    var velTangC1 = c1.xv * tangX + c1.yv * tangY;
    var velTangC2 = c2.xv * (-tangX) + c2.yv * (-tangY);

    var velNormC2FrameC1 = velNormC1 + velNormC2;
    var velNormC2FrameC2 = 0;

    var velNormC2FramePostC1 = velNormC2FrameC1 * ( c1.m - c2.m ) / ( c1.m + c2.m );
    var velNormC2FramePostC2 = 2 * c1.m / ( c1.m + c2.m ) * velNormC2FrameC1;

    velNormC1 = velNormC1 + ( velNormC2FramePostC1 - velNormC2FrameC1 );
    velNormC2 = velNormC2 - ( velNormC2FramePostC2 - velNormC2FrameC2 );

    c1.xv = velNormC1 * normalX + velTangC1 * tangX;
    c1.yv = velNormC1 * normalY + velTangC1 * tangY;

    c2.xv = velNormC2 * (-normalX) + velTangC2 * (-tangX);
    c2.yv = velNormC2 * (-normalY) + velTangC2 * (-tangY);
}
