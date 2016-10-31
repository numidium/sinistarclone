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
            for (entIndex = 0; entIndex < entities.length; entIndex++) {
                entities[entIndex].updateState(TIMESTEP);
            }
            timeDelta -= TIMESTEP;
        }
        // Drawing
        CTX.clearRect(0, 0, CANVAS.width, CANVAS.height); // clear the canvas
        for (entIndex = 0; entIndex < entities.length; entIndex++) {
            entities[entIndex].draw();
        }
        requestAnimationFrame(mainLoop);
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
    function distance(x1, y1, x2, y2) {
        return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
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
        collisionRadius: 15,
        updateState: function(delta) {
            var entIndex;
            var other;
            
            this.angle += this.angleDelta * delta;
            if (this.throttle) {
                this.xVelDelta = .0003 * Math.cos(this.angle + Math.PI / 2);
                this.yVelDelta = .0003 * Math.sin(-(this.angle + Math.PI / 2));
            } else {
                this.xVelDelta = this.yVelDelta = 0;
            }
            // Velocity is in units of pixels per millisecond.
            this.xVel += this.xVelDelta * delta;
            this.yVel += this.yVelDelta * delta;
            if (this.xVel > this.maxVel) {
                this.xVel = this.maxVel;
            }
            if (this.yVel > this.maxVel) {
                this.yVel = this.maxVel;
            }
            if (this.xVel < -this.maxVel) {
                this.xVel = -this.maxVel;
            }
            if (this.yVel < -this.maxVel) {
                this.yVel = -this.maxVel;
            }
            this.x += this.xVel * delta;
            this.y += this.yVel * delta;
            // collision
            for (entIndex = 1; entIndex < entities.length; entIndex++) {
                other = entities[entIndex];
                if (
                    // within collision radius of other entity
                    distance(this.x + this.collisionRadius,
                             this.y + this.collisionRadius,
                             other.x + other.collisionRadius,
                             other.y + other.collisionRadius) <= other.collisionRadius &&
                    // headed towards the other entity
                    distance(this.x + this.xVel * other.collisionRadius,
                             this.y + this.yVel * other.collisionRadius,
                             other.x + other.collisionRadius,
                             other.y + other.collisionRadius) <= other.collisionRadius
                    ) {
                    this.xVel = -this.xVel;
                    this.yVel = -this.yVel;
                }
            }
        },
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
    function Asteroid(x, y, img) {
        this.x = x;
        this.y = y;
        this.image = img;
    };
    Asteroid.prototype = {
        x: 0,
        y: 0,
        image: "",
        updateState: function () {
            var test = Asteroid.prototype.collisionLines;
        },
        draw: function () {
            CTX.drawImage(document.getElementById(this.image),
                CANVAS.width / 2 + (this.x - playerRef.x),
                CANVAS.height / 2 + (this.y - playerRef.y));
        }
    };
    // Collision detectors
    document.addEventListener("DOMContentLoaded", function () {
        var pData;
        var pIndX;
        var pIndY;
        var pOffset;
        var imgWidth;
        var imgHeight;
        var imgID;
        var obj;
        function  createCollisionLines(obj, id, w, h) {
            CTX.drawImage(document.getElementById("asteroid1"), 0, 0);
            pData = CTX.getImageData(0, 0, w, h);
            // Every 2 entries is the beginning and ending point of a horizontal line
            obj.prototype.collisionLines = [];
            for (pIndY = 0; pIndY < h; pIndY++) {
                // Left X
                for (pIndX = 0; pIndX < w; pIndX++) {
                    pOffset = (pIndY * 4 * w) + pIndX * 4;
                    // detect non-black pixels
                    if (pData.data[pOffset] | pData.data[pOffset + 1] | pData.data[pOffset + 2] != 0) {
                        obj.prototype.collisionLines.push(pIndX);
                        break;
                    }
                }
                // Right X
                for (pIndX = w - 1; pIndX >= 0; pIndX--) {
                    pOffset = (pIndY * 4 * w) + pIndX * 4;
                    if (pData.data[pOffset] | pData.data[pOffset + 1] | pData.data[pOffset + 2] != 0) {
                        obj.prototype.collisionLines.push(pIndX);
                        break;
                    }
                }
            }
        };
        
        imgWidth = 60;
        imgHeight = 50;
        imgID = "asteroid1";
        obj = Asteroid;
        requestAnimationFrame(function () {
            createCollisionLines(obj, imgID, imgWidth, imgHeight);
        });
    });
    
    // Setup
    playerRef = new Player();
    entities.push(playerRef);
    entities.push(new Asteroid(150, 150, "asteroid1"));
    document.onkeydown = keyDownHandler;
    document.onkeyup = keyUpHandler;
    requestAnimationFrame(mainLoop); // Begin loop
}());