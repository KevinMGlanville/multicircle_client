/**
 * Represents a circle world, including mouse location to interact with the circles
 *
 * @author: Curtis Clements
 * @author: Jake Pitkin
 * @author: Kevin Glanville
 */

// the game world object
function CircleWorld(){

    // interaction information
    this.mouseX = 0;
    this.mouseY = 0;
    this.mPressed = false;

    // world limits
    this.xMin;
    this.xMax;
    this.yMin;
    this.yMax;

    // world objects
    this.circles = [];

    // pairs of colliding circles
    this.collisPairs = [];

    this.markedCircle = -1;

    // physical properties of the world
    this.shotMaxSpd = 27;
    this.shotSpdAdjust = 0.13;
    this.dragVal = 0.025;
    this.wallCoR = 0.8;

    // flags for calculations
    this.drag = true;
    this.ceiling = true;

    // The minimum speed a ball can move, used to change turns
    this.minimumVelocity = 0.05;

    // current highest velocity circle
    this.high_velocity = 0;
    this.collisCallback;

    // increment the world
    this.world_step = function (){
        this.applyDrag();
        incPos(this.circles);
        wallCollision(this.circles, this.xMin, this.xMax, this.yMin, this.yMax, this.wallCoR, this.ceiling);
        collisions(this.circles, this.collisPairs, this.collisCallback);
        this.clipVelocities();
        this.markCircle();
    }

    // determine if a circle is under the touched/clicked position
    this.markCircle = function () {
        if (this.mPressed && this.markedCircle == -1) {
            for (var i=0; i<this.circles.length; i++){
                var dist = distPoints(this.circles[i].x, this.circles[i].y, this.mouseX, this.mouseY);
                if (dist < this.circles[i].r){
                    this.markedCircle = i;
                }
            }
        }
    }

    // scale the released circle's velocity to the maximum
    this.setMarkedVelocity = function (){
        var originX = this.circles[this.markedCircle].x;
        var originY = this.circles[this.markedCircle].y;

        if( Math.abs(this.mouseX-originX) > 0 || Math.abs(this.mouseY-originY)>0) {
            var dist = distPoints(this.mouseX, this.mouseY, originX, originY);
            var xDiffUnit = (this.mouseX - originX) / dist;
            var yDiffUnit = (this.mouseY - originY) / dist;
            var velocity = Math.min(this.shotMaxSpd, dist * this.shotSpdAdjust);
            this.circles[this.markedCircle].xv = xDiffUnit * velocity;
            this.circles[this.markedCircle].yv = yDiffUnit * velocity;
        }
    }

    // a circle with properties
    this.CircleWP = function (x, y, r, xv, yv, color) {
        this.x = x;
        this.y = y;
        this.r = r;
        this.xv = xv;
        this.yv = yv;
        this.m = 4/3 * Math.PI * Math.pow( this.r, 3);
        this.color = color;
    }

    // slow down the circles
    this.applyDrag = function (){
        for(var i=0; i< this.circles.length; i++){
            if (this.drag){
                this.circles[i].xv *= (1-this.dragVal);
                this.circles[i].yv *= (1-this.dragVal);
            }
        }
    }

    // cutoff velocities below minimum threshold
    this.clipVelocities = function (){
        // Check if all balls velocity are under
        // a given minimum velocity
        this.high_velocity = 0;
        for (var i = 0; i < this.circles.length; i++)
        {
            // stop circles below min velocity
            var velocity = Math.sqrt( Math.pow(this.circles[i].xv, 2) + Math.pow(this.circles[i].yv, 2));
            if(velocity <= this.minimumVelocity)
            {
                this.circles[i].xv = 0;
                this.circles[i].yv = 0;
            }
            this.high_velocity = Math.max(velocity, this.high_velocity);
        }
    }
}
