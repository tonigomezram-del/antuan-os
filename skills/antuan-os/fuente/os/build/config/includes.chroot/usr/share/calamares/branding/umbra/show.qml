/*
 * Diapositivas del Instalador Antuan (slideshowAPI: 2).
 * Cinco imagenes de 1200x700 que cambian cada 7 segundos con un fundido
 * suave y un ligero acercamiento. Solo usa QtQuick (sin modulos extra).
 */
import QtQuick 2.15

Item {
    id: presentacion
    width: 1200
    height: 700

    // Calamares (API 2) pone esta propiedad y llama a onActivate/onLeave
    property bool activatedInCalamares: false
    property int actual: 0
    readonly property int intervalo: 7000

    readonly property var diapositivas: [
        { imagen: "diapositivas/1.png", texto: "Bienvenido a Antuan" },
        { imagen: "diapositivas/2.png", texto: "Tu escritorio, a tu manera: dock, Spotlight y Mission Control" },
        { imagen: "diapositivas/3.png", texto: "Tus juegos, al máximo con el Modo Juego" },
        { imagen: "diapositivas/4.png", texto: "Antuan Tienda: todas tus apps de un clic" },
        { imagen: "diapositivas/5.png", texto: "Seguro y tuyo" }
    ]

    function onActivate() {
        actual = 0
        temporizador.restart()
    }
    function onLeave() {
        temporizador.stop()
    }
    function ir(n) {
        actual = (n + diapositivas.length) % diapositivas.length
        temporizador.restart()
    }

    Timer {
        id: temporizador
        interval: presentacion.intervalo
        repeat: true
        running: true
        onTriggered: presentacion.actual = (presentacion.actual + 1) % presentacion.diapositivas.length
    }

    // Fondo Antuan (por si la imagen no llena todo el hueco)
    Rectangle {
        anchors.fill: parent
        color: "#07080b"
    }

    // Diapositivas superpuestas: solo la actual es visible
    Repeater {
        model: presentacion.diapositivas.length
        delegate: Image {
            id: diapositiva
            readonly property bool activa: index === presentacion.actual
            anchors.fill: parent
            source: presentacion.diapositivas[index].imagen
            fillMode: Image.PreserveAspectFit
            smooth: true
            mipmap: true
            asynchronous: false
            opacity: activa ? 1.0 : 0.0
            scale: activa ? 1.0 : 1.035
            Accessible.name: presentacion.diapositivas[index].texto

            Behavior on opacity {
                NumberAnimation { duration: 900; easing.type: Easing.InOutQuad }
            }
            Behavior on scale {
                NumberAnimation { duration: 1400; easing.type: Easing.OutCubic }
            }
        }
    }

    // Indicador de posicion: puntos, el actual alargado en color de acento
    Row {
        anchors.horizontalCenter: parent.horizontalCenter
        anchors.bottom: parent.bottom
        anchors.bottomMargin: Math.max(12, parent.height * 0.035)
        spacing: 8

        Repeater {
            model: presentacion.diapositivas.length
            delegate: Rectangle {
                readonly property bool activa: index === presentacion.actual
                width: activa ? 26 : 8
                height: 8
                radius: 4
                color: activa ? "#9db4ff" : "#33384a"

                Behavior on width { NumberAnimation { duration: 350; easing.type: Easing.OutCubic } }
                Behavior on color { ColorAnimation { duration: 350 } }

                MouseArea {
                    anchors.fill: parent
                    anchors.margins: -6
                    cursorShape: Qt.PointingHandCursor
                    onClicked: presentacion.ir(index)
                }
            }
        }
    }

    // Clic en la mitad derecha: siguiente; en la izquierda: anterior
    MouseArea {
        anchors.fill: parent
        z: -1
        onClicked: function (raton) {
            presentacion.ir(presentacion.actual + (raton.x > width / 2 ? 1 : -1))
        }
    }
}
