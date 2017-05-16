(function () {
    var CANVAS = document.getElementById('gameCanvas');
    var CTX = CANVAS.getContext('2d');
    var TIMESTEP = 10; // How finely the state is interpolated between frames. Higher = choppier.
	var HUD_HEIGHT = 80;
	var MINIMAP_SCALE = 30;
	var MAX_DISTANCE = 1500;
	var mmLeft = CANVAS.width / 2 - HUD_HEIGHT / 2;
    var timeDelta = 0;
	var MAX_TIME_DELTA = 1000; // less than 1 fps is not worth interpolating
    var lastFrameTimestamp = 0;
    var entities = [];
    var asteroids;
    var asteroidCount = 0;
    var crystals;
    var crystalCount = 0;
    var workers;
    var workerCount = 0;
    var playerRef;
	var index;
	var entRef;
	var screenX;
	var screenY;
	var MAX_SCREEN_BOUND_X = 100;
	var MAX_SCREEN_BOUND_Y = 50;
	var screenBoundX;
	var screenBoundY;
    function mainLoop(timeStamp) {
        var entIndex;
		var curEnt;
		var mmX; // minimap x, y
		var mmY;
        
        timeDelta += timeStamp - lastFrameTimestamp;
		timeDelta = timeDelta > MAX_TIME_DELTA ? MAX_TIME_DELTA : timeDelta;
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
			curEnt = entities[entIndex];
            entities[entIndex].draw();
        }
		// Draw HUD
		CTX.fillStyle = "#000090";
		CTX.fillRect(0, 0, CANVAS.width, HUD_HEIGHT);
		CTX.fillStyle = "#000040";
		CTX.fillRect(mmLeft, 0, 80, 80);
		CTX.beginPath();
		CTX.strokeStyle = "#FFFF00";
		// visible distance rectangle
		CTX.rect(mmLeft + HUD_HEIGHT / 2 - (playerRef.x - screenX + CANVAS.width / 2) / MINIMAP_SCALE,
			HUD_HEIGHT / 2 - (playerRef.y - screenY + (CANVAS.height - HUD_HEIGHT) / 2) / MINIMAP_SCALE,
			CANVAS.width / MINIMAP_SCALE,
			(CANVAS.height - HUD_HEIGHT) / MINIMAP_SCALE);
		CTX.stroke();
		// Draw minimap blips
		for (entIndex = 0; entIndex < entities.length; entIndex++) {
			curEnt = entities[entIndex];
			mmX = mmLeft + HUD_HEIGHT / 2 - 1 + (curEnt.x - playerRef.x) / MINIMAP_SCALE;
			if (mmX - 1 < mmLeft || mmX + 1 >= mmLeft + HUD_HEIGHT) {
				continue;
			}
			mmY = HUD_HEIGHT / 2 - 1 + (curEnt.y - playerRef.y) / MINIMAP_SCALE;
			if (mmY < 0 || mmY + 1 >= HUD_HEIGHT) {
				continue;
			}
			CTX.fillStyle = curEnt.blipColor;
			CTX.fillRect(mmX, mmY, 2, 2);
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
        return Math.sqrt(Math.pow(x1 - x0, 2) + Math.pow(y1 - y0, 2));
    };
	function lineCheck(x1, y1, x2, y2, x3, y3, x4, y4) {
		var a_dx = x2 - x1;
		var a_dy = y2 - y1;
		var b_dx = x4 - x3;
		var b_dy = y4 - y3;
		var s = (-a_dy * (x1 - x3) + a_dx * (y1 - y3)) / (-b_dx * a_dy + a_dx * b_dy);
		var t = (+b_dx * (y1 - y3) - b_dy * (x1 - x3)) / (-b_dx * a_dy + a_dx * b_dy);
		
		return (s >= 0 && s <= 1 && t >= 0 && t <= 1);
	};
	function triangleEdgeCheck(obj, other) {
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
	function checkCollision(subject) {
		var entIndex;
		var other;
		var otherColl;
		var sLineInd;
		var oLineInd;
		var collX1;
		var collX2;
		var collY;
		
		for (entIndex = 0; entIndex < entities.length; entIndex++) {
			other = entities[entIndex];
			if (other == subject) {
				continue;
			}
			// There are algorithms that can do faster polygonal collsion detection.
			// Maybe replace this with one of those later.
			if (distance(subject.x, subject.y, other.x, other.y) < subject.collRadius + other.collRadius) {
                for (sLineInd = 0; sLineInd < subject.collLines.length; sLineInd += 2) {
                    for (oLineInd = 0; oLineInd < other.collLines.length; oLineInd += 2) {
                        if (lineCheck(
                            subject.collLines[sLineInd] + subject.x,
                            subject.collLines[sLineInd + 1] + subject.y,
                            subject.collLines[(sLineInd + 2) % subject.collLines.length] + subject.x,
                            subject.collLines[(sLineInd + 3) % subject.collLines.length] + subject.y,
                            other.collLines[oLineInd] + other.x,
                            other.collLines[oLineInd + 1] + other.y,
                            other.collLines[(oLineInd + 2) % other.collLines.length] + other.x,
                            other.collLines[(oLineInd + 3) % other.collLines.length] + other.y
                            )) {
                                return other;
                        }
                    }
                }
			}
		}
		
		return null;
	};
    function getRandomIndex(arr) {
        return arr[Math.round(Math.random() * (arr.length - 1))];
    };
	function moveSelf(delta) {
		var oldAngle;
		var velSign;
		var other;
		
		oldAngle = this.angle;
		this.angle += this.angleDelta * delta;
		this.updateCollLines();
		// angular collision
		if (checkCollision(this)) {
			this.angle = oldAngle;
			this.updateCollLines();
		}
		if (this.throttle) {
			this.xVelDelta = this.accel * Math.cos(this.angle + Math.PI / 2);
			this.yVelDelta = this.accel * Math.sin(-(this.angle + Math.PI / 2));
		} else {
			// slow to a stop
			if (Math.abs(this.xVel) > this.accel) {
				this.velSign = this.xVel >= 0 ? -1 : 1;
				this.xVelDelta = this.velSign * (this.accel / 3);
			} else {
				this.xVelDelta = 0;
				this.xVel = 0;
			}
			if (Math.abs(this.yVel) > this.accel) {
				this.velSign = this.yVel >= 0 ? -1 : 1;
				this.yVelDelta = this.velSign * (this.accel / 3);
			} else {
				this.yVelDelta = 0;
				this.yVel = 0;
			}
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
		other = checkCollision(this);
		if (other) {
			this.xVel = -this.xVel;
			this.yVel = -this.yVel;
			if (other instanceof Asteroid) { // asteroid bumped me
				if ((this.xVel > 0 && this.xVel < other.xVel) ||
					(this.xVel < 0 && -1 * this.xVel < other.xVel) ||
					(this.xVel < 0 && this.xVel > other.xVel) ||
					(this.xVel > 0 && -1 * this.xVel > other.xVel) ||
					this.xVel == 0) {
					this.xVel += other.xVel * 2;
				}
				if ((this.yVel > 0 && this.yVel < other.yVel) ||
					(this.yVel < 0 && -1 * this.yVel < other.yVel) ||
					(this.yVel < 0 && this.yVel > other.yVel) ||
					(this.yVel > 0 && -1 * this.yVel > other.yVel) ||
					this.yVel == 0) {
					this.yVel += other.yVel * 2;
				}				
			}
			// bounce away cleanly
			this.x += this.xVel * delta;
			this.y += this.yVel * delta;
		}
	};
	function wrapAngle(angle) {
		var periodAngle;
		
		if (angle > 2 * Math.PI) {
			periodAngle = angle - 2 * Math.PI;
		} else if (angle < 0) {
			periodAngle = angle + 2 * Math.PI;
		} else {
			periodAngle = angle;
		}
		
		return periodAngle;
	};
    // Objects
    function Player() {};
    Player.prototype = {
        x: 0,
        y: 0,
		imgWidth: 0,
		imgHeight: 0,
		blipColor: "#FFFFFF",
        angle: 0,
        xVel: 0,
        yVel: 0,
        xVelDelta: 0,
        yVelDelta: 0,
		accel: .0004,
        angleDelta: 0,
        maxVel: .3,
        throttle: false,
        collRadius: 50,
		collLines: [],
        updateCollLines: function () {
            this.collLines[0] = Math.cos(Math.PI / 2 + this.angle) * this.collRadius;
            this.collLines[1] = Math.sin(-Math.PI / 2 - this.angle) * this.collRadius;
            this.collLines[2] = (Math.cos(Math.PI * (4 / 3) + this.angle) * this.collRadius);
            this.collLines[3] = (Math.sin(-Math.PI * (4 / 3) - this.angle) * this.collRadius);
            this.collLines[4] = (Math.cos(Math.PI * (5 / 3) + this.angle) * this.collRadius);
            this.collLines[5] = (Math.sin(-Math.PI * (5 / 3) - this.angle) * this.collRadius);
        },
        updateState: function(delta) {
			moveSelf.call(this, delta);
			// make the screen track the player
			screenBoundX = Math.abs((this.xVel / this.maxVel)) * MAX_SCREEN_BOUND_X;
			screenBoundY = Math.abs((this.yVel / this.maxVel)) * MAX_SCREEN_BOUND_Y;
			if (this.x - screenX > screenBoundX) {
				screenX = this.x - screenBoundX;
			}
			else if (this.x - screenX < -screenBoundX) {
				screenX = this.x + screenBoundX;
			}
			if (this.y - screenY > screenBoundY) {
				screenY = this.y - screenBoundY;
			}
			else if (this.y - screenY < -screenBoundY) {
				screenY = this.y + screenBoundY;
			}
        },
        draw: function() {
            var xCenter = CANVAS.width / 2 + (this.x - screenX);
            var yCenter = CANVAS.height / 2 + (this.y - screenY) + (HUD_HEIGHT / 2);
            var index;
            
            CTX.beginPath();
            CTX.moveTo(xCenter + this.collLines[0],
                yCenter + this.collLines[1]);
            for (index = 2; index < this.collLines.length; index += 2) {
                CTX.lineTo(xCenter + this.collLines[index],
                    yCenter + this.collLines[index + 1]);
            }
            CTX.fillStyle = "#00FF00";
            CTX.fill();
        }
    };
    function Asteroid(x, y) {
        var pointInd;
        var angle;
        var vertexCount = 10;
        var angleInc = (2 * Math.PI) / vertexCount;
        var minRadius = 10;
        var maxRadius = 50;
		var maxAppliedRadius = maxRadius;
        var radius;
        
        this.x = x;
        this.y = y;
		this.xVel = -.1 + Math.random() * .2;
		this.yVel = -.1 + Math.random() * .2;
		this.collLines = [];
        // Generate polygon points
        for (pointInd = 0; pointInd < vertexCount; pointInd++) {
            angle = pointInd * angleInc + Math.random() * (angleInc - .01);
            radius = minRadius + Math.random() * (maxRadius - minRadius);
			if (radius < maxAppliedRadius) {
				radius = maxAppliedRadius;
				maxAppliedRadius -= 10;
			}
            if (radius > this.collRadius) {
                this.collRadius = radius;
            }
            this.collLines.push(Math.round(Math.cos(angle) * radius));
            this.collLines.push(Math.round(Math.sin(angle) * radius));
        }
    };
    Asteroid.prototype = {
        constructor: Asteroid,
        x: 0,
        y: 0,
        collRadius: 0,
		blipColor: "#777777",
        collLines: [],
        updateState: function (delta) {
			this.x += this.xVel * delta;
			this.y += this.yVel * delta;
			// wrap around effective playing field
			if (this.x - playerRef.x > MAX_DISTANCE) {
				this.x = playerRef.x - MAX_DISTANCE + 2;
			} else if (this.x - playerRef.x < -MAX_DISTANCE) {
				this.x = playerRef.x + MAX_DISTANCE - 2;
			}
			if (this.y - playerRef.y > MAX_DISTANCE) {
				this.y = playerRef.y - MAX_DISTANCE + 2;
			} else if (this.y - playerRef.y < -MAX_DISTANCE) {
				this.y = playerRef.y + MAX_DISTANCE - 2;
			}
        },
        draw: function () {
            var index;
            
            CTX.beginPath();
            CTX.moveTo(CANVAS.width / 2 + (this.x - screenX) + this.collLines[0],
                CANVAS.height / 2 + (this.y + HUD_HEIGHT / 2 - screenY) + this.collLines[1]);
            for (index = 2; index < this.collLines.length - 1; index += 2) {
                CTX.lineTo(CANVAS.width / 2 + (this.x - screenX) + this.collLines[index],
                    CANVAS.height / 2 + HUD_HEIGHT / 2 + (this.y - screenY) + this.collLines[index + 1]);
            }
            CTX.lineTo(CANVAS.width / 2 + (this.x - screenX) + this.collLines[0],
                    CANVAS.height / 2 + HUD_HEIGHT / 2 + (this.y - screenY) + this.collLines[1]);
            CTX.fillStyle = "#AAAAAA";
            CTX.fill();
        }
    };
	function Worker(x, y) {
		this.x = x;
		this.y = y;
		this.target = playerRef;
		this.collLines = new Array(6);
	};
    Worker.prototype = {
        x: 0,
        y: 0,
		imgWidth: 0,
		imgHeight: 0,
		blipColor: "#FF0000",
        angle: 0,
        xVel: 0,
        yVel: 0,
        xVelDelta: 0,
        yVelDelta: 0,
		accel: .0004,
        angleDelta: 0,
        maxVel: .3,
        throttle: true,
        collRadius: 13,
		collLines: [],
        target: null,
		angleToTarget: 0,
		turnSpeed: .003,
        updateCollLines: function () {
            this.collLines[0] = Math.cos(Math.PI / 2 + this.angle) * this.collRadius;
            this.collLines[1] = Math.sin(-Math.PI / 2 - this.angle) * this.collRadius;
            this.collLines[2] = (Math.cos(Math.PI * (4 / 3) + this.angle) * this.collRadius);
            this.collLines[3] = (Math.sin(-Math.PI * (4 / 3) - this.angle) * this.collRadius);
            this.collLines[4] = (Math.cos(Math.PI * (5 / 3) + this.angle) * this.collRadius);
            this.collLines[5] = (Math.sin(-Math.PI * (5 / 3) - this.angle) * this.collRadius);
        },
		updateState: function (delta) {
			var angleToTarget = 0;
			
			this.updateCollLines();
            // update target
            if (crystalCount == 0 && (this.target instanceof Crystal || this.target == playerRef)) {
                this.target = getRandomIndex(asteroids);
            } else if (this.target instanceof Asteroid && crystalCount > 0) {
                this.target = getRandomIndex(crystals);
            } else if (distance(this.x, this.y, this.target.x, this.target.y) < 20) {
				this.target = getRandomIndex(asteroids);
			}
			// movement
			this.angle = wrapAngle(this.angle);
			angleToTarget = this.getAngleTo(this.target);
			// find the shortest arc and turn towards the target
			if (Math.abs(this.angle - angleToTarget) > Math.PI) {
				if (this.angle > angleToTarget) {
					this.angle += this.turnSpeed * delta;
				} else {
					this.angle -= this.turnSpeed * delta;
				}
			} else {
				if (this.angle > angleToTarget) {
					this.angle -= this.turnSpeed * delta;
				} else {
					this.angle += this.turnSpeed * delta;
				}
			}
			moveSelf.call(this, delta);
		},
		getAngleTo: function (other) {
			var angleTo = Math.atan2(-(other.y - this.y), other.x - this.x) - Math.PI / 2;
			
			angleTo = wrapAngle(angleTo);
			
			return angleTo;
		},
		draw: function () {
			var index;
			
			CTX.beginPath();
			CTX.moveTo(CANVAS.width / 2 + (this.x - screenX) + this.collLines[0],
				CANVAS.height / 2 + (this.y + HUD_HEIGHT / 2 - screenY) + this.collLines[1]);
			for (index = 2; index < this.collLines.length; index += 2) {
				CTX.lineTo(CANVAS.width / 2 + (this.x - screenX) + this.collLines[index],
					CANVAS.height / 2 + HUD_HEIGHT / 2 + (this.y - screenY) + this.collLines[index + 1]);
			}
			CTX.lineTo(CANVAS.width / 2 + (this.x - screenX) + this.collLines[0],
					CANVAS.height / 2 + HUD_HEIGHT / 2 + (this.y - screenY) + this.collLines[1]);
			CTX.fillStyle = "#FF0000";
			CTX.fill();
		}
	}
    function Crystal(x, y) {
        this.x = x;
        this.y = y;
    };
    Crystal.prototype = {
        x: 0,
        y: 0
    };
    
    // Setup
    playerRef = new Player();
    entities.push(playerRef);
	screenX = playerRef.x;
	screenY = playerRef.y;
	CTX.lineWidth = 1;
	// Scatter some asteroids around the player
    asteroids = new Array(50);
	for (index = 0; index < 50; index++) {
		entities.push(new Asteroid(
			(Math.random() >= .5 ? 1 : -1) * Math.random() * (MAX_DISTANCE - 100) + 200,
			(Math.random() >= .5 ? 1 : -1) * Math.random() * (MAX_DISTANCE - 100) + 200));
		entRef = entities[index + 1];
		// move out of the way if on top of the player
		if (distance(entRef.x, entRef.y, playerRef.x, playerRef.y) < 100) {
			entRef.x += entRef.collRadius;
		}
        // register each asteroid
        asteroids[index] = entRef;
        asteroidCount++;
	}
    crystals = new Array(50);
	entities.push(new Worker(300, 300));
    workerCount++;
	entities.push(new Worker(320, 320));
    workerCount++;
	entities.push(new Worker(340, 340));
    workerCount++;
	entities.push(new Worker(360, 360));
    workerCount++;
	entities.push(new Worker(380, 380));
    workerCount++;
    document.onkeydown = keyDownHandler;
    document.onkeyup = keyUpHandler;
    requestAnimationFrame(mainLoop); // Begin loop
}());