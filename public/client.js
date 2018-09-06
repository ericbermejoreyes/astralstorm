$(document).ready(function (initial) {
    addEventListener("beforeunload", function (e) {
        let confirmationMessage = 'Are you sure you want to leave?';

        e.returnValue = confirmationMessage;
        return confirmationMessage;
    });

    /*GAME VARIABLES*/
    let game = new Canvas('#game-world', {width: $(window).width(), height: $(window).height()});
    let infos = new Canvas('#infos', {width: $(window).width(), height: $(window).height()});

    let socket = io();

    playerKey = null;
    _objects = null;
    _world = null;
    _assets = null;
    //pointer lock canvas on click
    document.onclick = () => {
        let name = '';
        if (!playerKey) {
            name = promptIGN('Enter your name: ').toUpperCase().substr(0, 10);
            playerKey = name + random(1000, 1000000);
            socket.emit('player::new', {key: playerKey, name});
        }
        pointerLock(infos.elem);
    };

    socket.once('assets::load', (data) => {
        _assets = data;
    });
    socket.once('world::load', (data) => {
        _world = data;
    });

    socket.on('objects::update', function (data) {
        _objects = data;
    });

    _input = {
        mouse: {X: infos.elem.width * 0.5, Y: infos.elem.height * 0.5}
    };

    //event listeners for user input
    $(document).on('keydown keyup mousedown mouseup', (e) => {
        if (document.pointerLockElement === infos.elem || document.mozPointerLockElement === infos.elem) {
            let key = String.fromCharCode(e.which || e.keyCode).toUpperCase();
            let mouseKey = ['L', 'M', 'R'];
            if (!_input.keyPress) _input.keyPress = {};
            switch (e.type) {
                case 'keydown':
                    _input.keyPress[key] = true;
                    break;
                case 'keyup':
                    delete _input.keyPress[key];
                    break;
                case 'mousedown':
                    _input.mouse[mouseKey[(e.which || e.keyCode) - 1]] = true;
                    break;
                case 'mouseup':
                    delete _input.mouse[mouseKey[(e.which || e.keyCode) - 1]];
            }
        }
    });

    infos.elem.addEventListener('mousemove', (e) => {
        if (document.pointerLockElement === infos.elem || document.mozPointerLockElement === infos.elem) {
            _input.mouse.X += e.movementX;
            _input.mouse.Y += e.movementY;

            _input.mouse.X = Math.max(0, Math.min(_input.mouse.X, infos.elem.width));
            _input.mouse.Y = Math.max(0, Math.min(_input.mouse.Y, infos.elem.height));
        }
    }, false);

    /*DISPLAY MANAGEMENT*/
    requestAnimationFrame(step);

    function step(tick) {
        requestAnimationFrame(step);
        if (!playerKey && !_objects && !_assets) return;

        game.clear();
        infos.clear();

        let main = _objects ? _objects.find((obj) => {
            return obj.id === playerKey;
        }) : null;

        //draw background
        for (let i = 0; i <= _world.width; i += 50) {
            game.ctx.strokeStyle = '#1f1f1f';
            game.ctx.setLineDash([1, 5]);
            game.ctx.beginPath();
            game.ctx.moveTo(i, 0);
            game.ctx.lineTo(i, _world.height);
            game.ctx.stroke();
        }

        for (let i = 0; i <= _world.height; i += 50) {
            game.ctx.strokeStyle = '#1f1f1f';
            game.ctx.setLineDash([1, 5]);
            game.ctx.beginPath();
            game.ctx.moveTo(0, i);
            game.ctx.lineTo(_world.width, i);
            game.ctx.stroke();
        }

        for (let i in _objects) {
            let data = _objects[i];
            //draw objects;
            game.drawSprite(data);
        }

        if (!!main && !main.destroyed) {
            //draw player cursor
            let mColor = '#FFFFFF';
            infos.ctx.save();
            infos.ctx.translate(main._input.mouse.X, main._input.mouse.Y);
            infos.draw(0 - 10, 0, 20, 1, mColor);
            infos.draw(0, 0 - 10, 1, 20, mColor);
            infos.draw(0 - 15, 0 - 15, 10, 1, mColor);
            infos.draw(0 + 5, 0 + 15, 10, 1, mColor);
            infos.draw(0 + 5, 0 - 15, 10, 1, mColor);
            infos.draw(0 - 15, 0 + 15, 10, 1, mColor);
            infos.draw(0 - 15, 0 - 15, 1, 10, mColor);
            infos.draw(0 + 15, 0 + 5, 1, 10, mColor);
            infos.draw(0 + 15, 0 - 15, 1, 10, mColor);
            infos.draw(0 - 15, 0 + 5, 1, 10, mColor);
            infos.ctx.strokeStyle = mColor;
            infos.ctx.beginPath();
            infos.ctx.lineWidth = 1;
            infos.ctx.arc(0 + 0.5, 0 + 0.5, 5, 0, 2 * Math.PI);
            infos.ctx.stroke();
            infos.ctx.restore();
        }

        if (!!main && !main.destroyed) game.follow(main);

        socket.emit('io::update', {key: playerKey, io: _input});
    };
});

/*FUNCTIONS*/
function random(min, max) {
    return Math.floor((Math.random() * max) + min);
}

function promptIGN(msg) {
    let IGN = prompt(msg);
    return IGN ? IGN : promptIGN(msg);
}

function collision(obj1, obj2, filter) {
    let result = {};
    result.result = false;
    let keys = Object.keys(obj2);

    for (let i = 0; i < keys.length; i++) {
        let key = keys[i];
        let col1 = obj1.collide;
        let col2 = obj2[key].collide;

        let dx = col1.x - col2.x;
        let dy = col1.y - col2.y;
        let distance = Math.sqrt(dx * dx + dy * dy);

        if (key != filter && distance < col1.radius + col2.radius) {
            result.key = key;
            result.x = col1.x;
            result.y = col2.y;
            result.result = true;
        }
    }

    return result;
}

function pointerLock(canvas) {
    canvas.requestPointerLock = canvas.requestPointerLock || canvas.mozRequestPointerLock;
    canvas.requestPointerLock();
}

/*Objects*/
function Canvas(target, o) {
    this.elem = document.querySelector(target);
    this.ctx = this.elem.getContext('2d');
    this.pan = {x: 0, y: 0};

    this.elem.width = o.width;
    this.elem.height = o.height;

    this.draw = function (x, y, w, h, fillStyle, lineWidth, strokeStyle) {
        if (fillStyle) {
            this.ctx.fillStyle = fillStyle;
            this.ctx.fillRect(x, y, w, h);
        }
        if (strokeStyle && lineWidth) {
            this.ctx.strokeStyle = strokeStyle;
            this.ctx.lineWidth = lineWidth;
            this.ctx.strokeRect(x, y, w, h);
        }
    };

    this.drawSprite = function (object) {
        if (!object._draw) return;
        if (!object.sprite) return;
        if (!_assets || !_assets[object.sprite.data]) return;
        let sprite = object.sprite;
        sprite.data = _assets[sprite.data];
        this.ctx.save();
        this.ctx.translate(sprite.x, sprite.y);
        this.ctx.scale(sprite.scale.x, sprite.scale.y);
        this.ctx.rotate(sprite.angle * Math.PI / 180);
        for (let key in sprite.data) {
            let a = null, v = null;

            if (typeof sprite.data[key] === 'object') {
                a = Object.keys(sprite.data[key])[0];
                v = sprite.data[key][a];
            } else {
                a = sprite.data[key];
            }

            switch(a) {
                case 'fs': this.ctx.fillStyle = v; break;
                case 'f': this.ctx.fill(); break;
                case 'ss': this.ctx.strokeStyle = v; break;
                case 's': this.ctx.stroke(); break;
                case 'lw': this.ctx.lineWidth = v; break;
                case 'gco': this.ctx.globalCompositeOperation = v; break;
                case 'bp': this.ctx.beginPath(); break;
                case 'cp': this.ctx.closePath(); break;
                case 'mt': this.ctx.moveTo(v[0], v[1]); break;
                case 'lt': this.ctx.lineTo(v[0], v[1]); break;
                case 'a': this.ctx.arc(v[0], v[1], v[2], v[3], v[4], v[5]); break;
                case 'at': this.ctx.arcTo(v[0], v[1], v[2], v[3], v[4]); break;
                case 'qct': this.ctx.quadraticCurveTo(v[0], v[1], v[2], v[3]); break;
                case 'bct': this.ctx.bezierCurveTo(v[0], v[1], v[2], v[3], v[4], v[5]); break;
            }
        }
        this.ctx.restore();
    };

    this.write = function (text, x, y, font, fillStyle) {

        if (text && fillStyle && font) {
            this.ctx.fillStyle = fillStyle;
            this.ctx.font = font;
            this.ctx.fillText(text, x, y);
        }
    };

    this.clear = function () {
        this.ctx.clearRect(0, 0, this.elem.width, this.elem.height);
    };

    this.follow = function (object) {

    }
}