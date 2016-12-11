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
    function distance(x0, y0, x1, y1) {
        return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    };
	function lineCheck(x0, y0, x1, y1, otherX1, otherX2, otherY) {
		// Trace along a line with Bresenham
		var _x0 = Math.round(x0);
		var _y0 = Math.round(y0);
		var _x1 = Math.round(x1);
		var _y1 = Math.round(y1);
		var dx = Math.abs(Math.round(x1 - x0));
		var dy = Math.abs(Math.round(y1 - y0));
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
	function triangleEdgeDraw(obj) {
		var points = [
					CANVAS.width / 2 + Math.cos(Math.PI / 2 + obj.angle) * obj.collRadius,
					CANVAS.height / 2 + Math.sin(-Math.PI / 2 - obj.angle) * obj.collRadius,
					CANVAS.width / 2 + Math.cos(Math.PI * (4 / 3) + obj.angle) * obj.collRadius,
					CANVAS.height / 2 + Math.sin(-Math.PI * (4 / 3) - obj.angle) * obj.collRadius,
					CANVAS.width / 2 + Math.cos(Math.PI * (5 / 3) + obj.angle) * obj.collRadius,
					CANVAS.height / 2 + Math.sin(-Math.PI * (5 / 3) - obj.angle) * obj.collRadius
				];
		var pointInd;
		
		// Make first two lines
		for (pointInd = 0; pointInd < 3; pointInd += 2) {	
			if (lineDraw(points[pointInd], points[pointInd + 1],
				points[pointInd + 2], points[pointInd + 3])) {
				return true;
			}
		}
		// Complete the triangle
		if (lineDraw(points[4], points[5], points[0], points[1])) {
			return true;
		}
		
		return false;
	};
	function lineDraw(x0, y0, x1, y1) {
		var _x0 = Math.round(x0);
		var _y0 = Math.round(y0);
		var _x1 = Math.round(x1);
		var _y1 = Math.round(y1);
		var dx = Math.abs(Math.round(x1 - x0));
		var dy = Math.abs(Math.round(y1 - y0));
		var sx = (_x0 < _x1) ? 1 : -1;
		var sy = (_y0 < _y1) ? 1 : -1;
		var error = dx - dy;
		var error2;
		
		CTX.fillStyle = "#FF0000";
		CTX.fillRect(_x0, _y0, 1, 1);
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
			CTX.fillRect(_x0, _y0, 1, 1);
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
        collRadius: 15,
		trianglePts: [],
        updateState: function(delta) {
            var entIndex;
            var other;
            var lineInd;
            var collX1;
            var collX2;
            var collY;
            
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
                // collision circle is within top and bottom collision lines
                if (this.y + this.collRadius > other.y &&
                    this.y - this.collRadius < other.y + other.imgHeight) {
                    // check for meeting points against either end of each line
                    for (lineInd = 0; lineInd < other.collisionLines.length; lineInd += 2) {
                        collX1 = other.x + other.collisionLines[lineInd];
                        collX2 = other.x + other.collisionLines[lineInd + 1];
                        collY = other.y + (lineInd / 2);
                        if (triangleEdgeCheck(this, collX1, collX2, collY)) {
                            this.xVel = -this.xVel;
                            this.yVel = -this.yVel;
                            // bounce away cleanly
                            this.x += this.xVel * delta;
                            this.y += this.yVel * delta;
                        }
                    }
                }
            }
        },
        draw: function() {
            var xCenter = CANVAS.width / 2;
            var yCenter = CANVAS.height / 2;

            // Draw a triangle to represent the character
			/*
            CTX.beginPath();
            CTX.moveTo(xCenter + Math.cos(Math.PI / 2 + this.angle) * this.collRadius,
                yCenter + Math.sin(-Math.PI / 2 - this.angle) * this.collRadius);
            CTX.lineTo(xCenter + (Math.cos(Math.PI * (4 / 3) + this.angle) * this.collRadius),
                yCenter + (Math.sin(-Math.PI * (4 / 3) - this.angle) * this.collRadius));
            CTX.lineTo(xCenter + (Math.cos(Math.PI * (5 / 3) + this.angle) * this.collRadius),
                yCenter + (Math.sin(-Math.PI * (5 / 3) - this.angle) * this.collRadius));
            CTX.fillStyle = "#FFFFFF";
            CTX.fill();
			*/
			triangleEdgeDraw(playerRef);
        },
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
        imgWidth: 60,
        imgHeight: 50,
        updateState: function () {
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
        function createCollisionLines(obj, id, w, h) {
            CTX.drawImage(document.getElementById(obj.prototype.image), 0, 0);
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
        createCollisionLines(obj, imgID, imgWidth, imgHeight);
    });
    
    // Setup
    playerRef = new Player();
    entities.push(playerRef);
    entities.push(new Asteroid(150, 150, "asteroid1"));
    document.onkeydown = keyDownHandler;
    document.onkeyup = keyUpHandler;
    requestAnimationFrame(mainLoop); // Begin loop
}());