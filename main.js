(function () {
    var CANVAS = document.getElementById('gameCanvas');
    var CTX = CANVAS.getContext('2d');
    var TIMESTEP = 10; // How finely the state is interpolated between frames. Higher = choppier.
	var HUD_HEIGHT = 80;
	var MINIMAP_SCALE = 50;
    var timeDelta = 0;
    var lastFrameTimestamp = 0;
    var entities = [];
    var playerRef;
    function mainLoop(timeStamp) {
        var entIndex;
		var mmLeft = CANVAS.width / 2 - 40;
        
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
		// Draw entities
        for (entIndex = 0; entIndex < entities.length; entIndex++) {
            entities[entIndex].draw();
        }
		// Draw HUD
		CTX.fillStyle = "#000090";
		CTX.fillRect(0, 0, CANVAS.width, HUD_HEIGHT);
		CTX.fillStyle = "#000040";
		CTX.fillRect(mmLeft, 0, 80, 80);
		for (entIndex = 0; entIndex < entities.length; entIndex++) {
			CTX.fillStyle = "#FFFFFF";
			CTX.fillRect(mmLeft + HUD_HEIGHT / 2 - 1 +
				(entities[entIndex].x + entities[entIndex].imgWidth / 2 - playerRef.x) / MINIMAP_SCALE,
				HUD_HEIGHT / 2 - 1 +
				(entities[entIndex].y + entities[entIndex].imgHeight / 2 - playerRef.y) / MINIMAP_SCALE,
				2, 2);
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
    function distance(x0, y0, x1, y1) {
        return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    };
	function lineCheck(x0, y0, x1, y1, otherX1, otherX2, otherY) {
		// Trace along a line with Bresenham
		var _x0 = x0;
		var _y0 = y0;
		var _x1 = x1;
		var _y1 = y1;
		var dx = Math.abs(x1 - x0);
		var dy = Math.abs(y1 - y0);
		var sx = (_x0 < _x1) ? 1 : -1;
		var sy = (_y0 < _y1) ? 1 : -1;
		var error = dx - dy;
		var error2;
		
		// Triangle is touching a collision line
		if (Math.abs(_y0 - otherY) <= 1 && _x0 >= otherX1 && _x0 <= otherX2) {
			return true;
		}
		while (Math.abs(_x0 - _x1) > 1 || Math.abs(_y0 - _y1) > 1) {
			error2 = error << 1;
			if (error2 > -dy) {
				error -= dy;
				_x0 += sx;
			}
			if (error2 < dx) {
				error += dx;
				_y0 += sy;
			}
			// Triangle is touching collision point
			if (Math.abs(_y0 - otherY) <= 1 && _x0 >= otherX1 && _x0 <= otherX2) {
				return true;
			}
		}
		
		return false;
	};
	function triangleEdgeCheck(obj, otherX1, otherX2, otherY) {
		var points = [
					obj.x + Math.cos(Math.PI / 2 + obj.angle) * obj.collRadius,
					obj.y + Math.sin(-Math.PI / 2 - obj.angle) * obj.collRadius,
					obj.x + Math.cos(Math.PI * (4 / 3) + obj.angle) * obj.collRadius,
					obj.y + Math.sin(-Math.PI * (4 / 3) - obj.angle) * obj.collRadius,
					obj.x + Math.cos(Math.PI * (5 / 3) + obj.angle) * obj.collRadius,
					obj.y + Math.sin(-Math.PI * (5 / 3) - obj.angle) * obj.collRadius
				];
		var pointInd;
		
		// Make first two lines
		for (pointInd = 0; pointInd < 3; pointInd += 2) {	
			if (lineCheck(points[pointInd], points[pointInd + 1],
				points[pointInd + 2], points[pointInd + 3],
				otherX1, otherX2, otherY)) {
				return true;
			}
		}
		// Complete the triangle
		if (lineCheck(points[4], points[5], points[0], points[1], otherX1, otherX2, otherY)) {
			return true;
		}
		
		return false;
	};
	function checkCollision(subject, edgeFunc) {
		var entIndex;
		var other;
		var lineInd;
		var collX1;
		var collX2;
		var collY;
		
		for (entIndex = 1; entIndex < entities.length; entIndex++) {
			other = entities[entIndex];
			// collision circle is within top and bottom collision lines
			if (subject.y + subject.collRadius > other.y &&
				subject.y - subject.collRadius < other.y + other.imgHeight) {
				// check for meeting points against either end of each line
				for (lineInd = 0; lineInd < other.collisionLines.length; lineInd += 2) {
					collX1 = other.x + other.collisionLines[lineInd];
					collX2 = other.x + other.collisionLines[lineInd + 1];
					collY = other.y + (lineInd / 2);
					if (edgeFunc(subject, collX1, collX2, collY)) {
						return true;
					}
				}
			}
		}
		
		return false;
	};
    // Objects
    function Player() {};
    Player.prototype = {
        x: 0,
        y: 0,
		image: "player",
		imgWidth: 0,
		imgHeight: 0,
        angle: 0,
        xVel: 0,
        yVel: 0,
        xVelDelta: 0,
        yVelDelta: 0,
        angleDelta: 0,
        maxVel: .3,
        throttle: false,
        collRadius: 15,
		trianglePts: [],
        updateState: function(delta) {
            var entIndex;
            var other;
            var lineInd;
            var collX1;
            var collX2;
            var collY;
			var oldAngle;
            
			oldAngle = this.angle;
			this.angle += this.angleDelta * delta;
			// angular collision
			if (checkCollision(this, triangleEdgeCheck)) {
				this.angle = oldAngle;
			}
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
			if (checkCollision(playerRef, triangleEdgeCheck)) {
				this.xVel = -this.xVel;
				this.yVel = -this.yVel;
				// bounce away cleanly
				this.x += this.xVel * delta;
				this.y += this.yVel * delta;
			}
        },
        draw: function() {
			var img = document.getElementById(this.image);
			
			CTX.save();
			CTX.translate(CANVAS.width / 2, (CANVAS.height / 2) + (HUD_HEIGHT / 2));
			CTX.rotate(-this.angle);
			CTX.drawImage(img, -img.width / 2, -img.height / 2);
			CTX.restore();
        }
    };
    function Asteroid(x, y, img) {
        this.x = x;
        this.y = y;
        this.image = img;
    };
    Asteroid.prototype = {
        constructor: Asteroid,
        x: 0,
        y: 0,
        image: "asteroid1",
        imgHeight: 0,
		imgWidth: 0,
        updateState: function () {
        },
        draw: function () {
            CTX.drawImage(document.getElementById(this.image),
                CANVAS.width / 2 + (this.x - playerRef.x),
                CANVAS.height / 2 + (this.y - playerRef.y) + (HUD_HEIGHT / 2));
        }
    };
    // Collision detectors
    document.addEventListener("DOMContentLoaded", function () {
        var pData;
        var pIndX;
        var pIndY;
        var pOffset;
        function createCollisionLines(obj, id) {
			var img = document.getElementById(obj.prototype.image);
			
			obj.prototype.imgHeight = img.height;
			obj.prototype.imgWidth = img.width;
            CTX.drawImage(img, 0, 0);
            pData = CTX.getImageData(0, 0, img.width, img.height);
            // Every 2 entries is the beginning and ending point of a horizontal line
            obj.prototype.collisionLines = [];
            for (pIndY = 0; pIndY < img.height; pIndY++) {
                // Left X
                for (pIndX = 0; pIndX < img.width; pIndX++) {
                    pOffset = (pIndY * 4 * img.width) + pIndX * 4;
                    // detect non-black pixels
                    if (pData.data[pOffset] | pData.data[pOffset + 1] | pData.data[pOffset + 2] != 0) {
                        obj.prototype.collisionLines.push(pIndX);
                        break;
                    }
                }
                // Right X
                for (pIndX = img.width - 1; pIndX >= 0; pIndX--) {
                    pOffset = (pIndY * 4 * img.width) + pIndX * 4;
                    if (pData.data[pOffset] | pData.data[pOffset + 1] | pData.data[pOffset + 2] != 0) {
                        obj.prototype.collisionLines.push(pIndX);
                        break;
                    }
                }
            }
        };
        
		document.getElementById("asteroid1").onload = function () {
			createCollisionLines(Asteroid, "asteroid1");
		};
    });
    
    // Setup
    playerRef = new Player();
    entities.push(playerRef);
    entities.push(new Asteroid(150, 150, "asteroid1"));
    document.onkeydown = keyDownHandler;
    document.onkeyup = keyUpHandler;
    requestAnimationFrame(mainLoop); // Begin loop
}());