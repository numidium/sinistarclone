(function () {
    var CANVAS = document.getElementById('gameCanvas');
    var CTX = CANVAS.getContext('2d');
    var TIMESTEP = 10; // How finely the state is interpolated between frames. Higher = choppier.
    var timeDelta = 0;
    var lastFrameTimestamp = 0;
    var entities = [];
    var playerRef;
    function mainLoop(timeStamp) {
        var entIndex;
        
        timeDelta += timeStamp - lastFrameTimestamp;
        lastFrameTimestamp = timeStamp;
        // Interpolate state updates
        while (timeDelta >= TIMESTEP) {
            updateState(TIMESTEP);
            timeDelta -= TIMESTEP;
        }
        // Drawing
        CTX.clearRect(0, 0, CANVAS.width, CANVAS.height); // clear the canvas
        for (entIndex = 0; entIndex < entities.length; entIndex++) {
            entities[entIndex].draw();
        }
        requestAnimationFrame(mainLoop);
    };
    function updateState(delta) {
        /*
        To ensure proper collision, the minimum dimension of an object must be
        vmax x dt (pixels)
        
        vmax = highest velocity that the fastest object can travel
        dt = the parameter "delta"
        */
        playerRef.angle += playerRef.angleDelta * delta;
        if (playerRef.throttle) {
            playerRef.xVelDelta = .0003 * Math.cos(playerRef.angle + Math.PI / 2);
            playerRef.yVelDelta = .0003 * Math.sin(-(playerRef.angle + Math.PI / 2));
        } else {
            playerRef.xVelDelta = playerRef.yVelDelta = 0;
        }
        // Velocity is in units of pixels per millisecond.
        playerRef.xVel += playerRef.xVelDelta * delta;
        playerRef.yVel += playerRef.yVelDelta * delta;
        if (playerRef.xVel > playerRef.maxVel) {
            playerRef.xVel = playerRef.maxVel;
        }
        if (playerRef.yVel > playerRef.maxVel) {
            playerRef.yVel = playerRef.maxVel;
        }
        if (playerRef.xVel < -playerRef.maxVel) {
            playerRef.xVel = -playerRef.maxVel;
        }
        if (playerRef.yVel < -playerRef.maxVel) {
            playerRef.yVel = -playerRef.maxVel;
        }
        playerRef.x += playerRef.xVel * delta;
        playerRef.y += playerRef.yVel * delta;
    };
    function keyDownHandler(e) {
        switch(e.keyCode) {
            case 38: // up
                playerRef.throttle = true;
                break;
            case 37: // left
                playerRef.angleDelta = .005;
                break;
            case 39: // right
                playerRef.angleDelta = -.005;
                break;
            default:
                break;
        }
    };
    function keyUpHandler(e) {
        switch(e.keyCode) {
            case 38: // up
                playerRef.throttle = false;
                break;
            case 37: // left
            case 39: // right
                playerRef.angleDelta = 0;
                break;
            default:
                break;
        }
    };
    // Objects
    function Player() {};
    Player.prototype = {
        x: 0,
        y: 0,
        angle: 0,
        xVel: 0,
        yVel: 0,
        xVelDelta: 0,
        yVelDelta: 0,
        angleDelta: 0,
        maxVel: .3,
        throttle: false,
        draw: function() {
            var radius = 15;
            var xCenter = CANVAS.width / 2;
            var yCenter = CANVAS.height / 2;

            // Draw a triangle to represent the character
            CTX.beginPath();
            CTX.moveTo(xCenter + Math.cos(Math.PI / 2 + this.angle) * radius,
                yCenter + Math.sin(-Math.PI / 2 - this.angle) * radius);
            CTX.lineTo(xCenter + (Math.cos(Math.PI * (4 / 3) + this.angle) * radius),
                yCenter + (Math.sin(-Math.PI * (4 / 3) - this.angle) * radius));
            CTX.lineTo(xCenter + (Math.cos(Math.PI * (5 / 3) + this.angle) * radius),
                yCenter + (Math.sin(-Math.PI * (5 / 3) - this.angle) * radius));
            CTX.fillStyle = "#FFFFFF";
            CTX.fill();
        }
    };
    function Asteroid(x, y) {
        this.x = x;
        this.y = y;
    };
    Asteroid.prototype = {
        x: 0,
        y: 0,
        draw: function () {
            var img = document.getElementById("asteroid1");
            
            CTX.drawImage(img, CANVAS.width / 2 + (this.x - playerRef.x),
                CANVAS.height / 2 + (this.y - playerRef.y));
        }
    };
    
    // Setup
    document.onkeydown = keyDownHandler;
    document.onkeyup = keyUpHandler;
    playerRef = new Player();
    entities.push(playerRef);
    entities.push(new Asteroid(200, 200));
    requestAnimationFrame(mainLoop); // Begin loop
}());